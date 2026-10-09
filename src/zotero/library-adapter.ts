import {
  normalizePaper,
  selectPrimaryAttachment,
  type PaperDTO,
  type RawPaper,
} from "../domain/metadata";
import type { LibraryScope } from "../domain/types";
import {
  readAttachment,
  type ZoteroAttachmentLike,
} from "./attachment-adapter";

export type ZoteroItemLike = {
  id: number;
  libraryID?: number;
  deleted?: boolean;
  getField: (field: string) => string;
  getCreators?: () => Array<Record<string, string>>;
  getTags?: () => Array<{ tag: string }>;
  getNotes?: () => number[];
  getAttachments?: () => number[];
  getCollections?: () => number[];
  getBestAttachment?: () => Promise<{ id: number } | false>;
  hasTag?: (tag: string) => boolean;
  isRegularItem?: () => boolean;
  attachmentLastRead?: number | null;
};

export type ZoteroFacade = {
  Libraries: { userLibraryID: number };
  Items: {
    get: (id: number) => ZoteroItemLike | ZoteroAttachmentLike | null;
    getAll: (libraryID: number) => ZoteroItemLike[] | Promise<ZoteroItemLike[]>;
  };
  Collections: {
    get: (id: number) => {
      getChildItems: (recursive?: boolean) => number[];
      addItems?: (ids: number[]) => void | Promise<void>;
      libraryID?: number;
      editable?: boolean;
    };
  };
  Reader: {
    open: (
      attachmentID: number,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
  DB?: { executeTransaction: (fn: () => Promise<void>) => Promise<void> };
};

export type LibraryAdapter = {
  list(scope: LibraryScope): Promise<PaperDTO[]>;
  get(itemID: number): Promise<PaperDTO | null>;
  addToCollection(itemIDs: number[], collectionID: number): Promise<void>;
  openPDF(itemID: number, attachmentID?: number): Promise<void>;
};

export function createLibraryAdapter(
  zotero: ZoteroFacade,
  options: { memoField?: string | null } = {},
): LibraryAdapter {
  return {
    async list(scope) {
      const items = await itemsForScope(zotero, scope);
      return Promise.all(
        items.map((item) =>
          normalizeItem(zotero, item, options.memoField || null),
        ),
      );
    },

    async get(itemID) {
      const item = zotero.Items.get(itemID) as ZoteroItemLike | null;
      if (!item || !item.isRegularItem?.()) return null;
      return normalizeItem(zotero, item, options.memoField || null);
    },

    async addToCollection(itemIDs, collectionID) {
      const collection = zotero.Collections.get(collectionID);
      if (!collection?.addItems || collection.editable === false || !zotero.DB)
        throw new Error("Collection cannot accept items");
      const ids = [...new Set(itemIDs)];
      for (const id of ids) {
        const item = zotero.Items.get(id) as ZoteroItemLike | null;
        if (
          !item?.isRegularItem?.() ||
          item.deleted ||
          item.libraryID !== collection.libraryID
        )
          throw new Error("Invalid collection item");
      }
      await zotero.DB.executeTransaction(async () => {
        await collection.addItems!(ids);
      });
    },

    async openPDF(itemID, attachmentID) {
      const item = zotero.Items.get(itemID) as ZoteroItemLike | null;
      if (!item) throw new Error("Item not found");
      const attachments = (await rawPaper(zotero, item)).attachments;
      if (
        attachmentID &&
        !attachments.some(
          (attachment) =>
            attachment.id === attachmentID &&
            attachment.contentType === "application/pdf",
        )
      )
        throw new Error("Invalid PDF attachment");
      const chosen = attachmentID || selectPrimaryAttachment(attachments)?.id;
      if (!chosen) throw new Error("No PDF attachment");
      await zotero.Reader.open(chosen);
    },
  };
}

async function itemsForScope(
  zotero: ZoteroFacade,
  scope: LibraryScope,
): Promise<ZoteroItemLike[]> {
  const all = async () =>
    (await zotero.Items.getAll(zotero.Libraries.userLibraryID)).filter(
      (item) => item.isRegularItem?.() && !item.deleted,
    );
  if (scope.kind === "library") return all();
  if (scope.kind === "tag")
    return (await all()).filter((item) => item.hasTag?.(scope.tag));
  return (zotero.Collections.get(scope.collectionID)?.getChildItems(true) || [])
    .map((id) => zotero.Items.get(id) as ZoteroItemLike)
    .filter((item) => Boolean(item?.isRegularItem?.() && !item.deleted));
}

async function normalizeItem(
  zotero: ZoteroFacade,
  item: ZoteroItemLike,
  memoField: string | null,
): Promise<PaperDTO> {
  const raw = await rawPaper(zotero, item);
  if (memoField) raw.fields[memoField] = safeField(item, memoField);
  return normalizePaper(raw, memoField);
}

async function rawPaper(
  zotero: ZoteroFacade,
  item: ZoteroItemLike,
): Promise<RawPaper> {
  const attachmentIDs = item.getAttachments?.() || [];
  const attachments = await Promise.all(
    attachmentIDs
      .map((id) => zotero.Items.get(id))
      .filter(Boolean)
      .map((attachment) => readAttachment(attachment as ZoteroAttachmentLike)),
  );
  const fields: Record<string, string> = {};
  const best = await item.getBestAttachment?.();
  if (best) {
    const chosen = attachments.find((attachment) => attachment.id === best.id);
    if (chosen) chosen.isPrimary = true;
  }
  for (const field of ["extra", "shortTitle"]) {
    fields[field] = safeField(item, field);
  }
  return {
    id: item.id,
    title: safeField(item, "title"),
    creators: item.getCreators?.(),
    publicationTitle: safeField(item, "publicationTitle"),
    date: safeField(item, "date"),
    DOI: safeField(item, "DOI"),
    abstractNote: safeField(item, "abstractNote"),
    tags: item.getTags?.(),
    notes: await readNotes(zotero, item.getNotes?.() || []),
    fields,
    attachments,
    attachmentLastRead:
      Math.max(
        0,
        ...attachmentIDs.map(
          (id) =>
            Number(
              (zotero.Items.get(id) as ZoteroItemLike)?.attachmentLastRead,
            ) || 0,
        ),
      ) * 1000 || null,
    collectionIDs: item.getCollections?.() || [],
    dateAdded: safeField(item, "dateAdded"),
  };
}

async function readNotes(
  zotero: ZoteroFacade,
  noteIDs: number[],
): Promise<string[]> {
  return noteIDs
    .map(
      (id) =>
        zotero.Items.get(id) as
          | (ZoteroItemLike & { getNote?: () => string })
          | null,
    )
    .filter(Boolean)
    .map((note) => note?.getNote?.() || "")
    .filter(Boolean);
}

function safeField(item: ZoteroItemLike, field: string): string {
  try {
    return item.getField(field) || "";
  } catch (_error) {
    return "";
  }
}
