import {
  normalizePaper,
  selectPrimaryAttachment,
  type PaperDTO,
  type RawPaper,
} from "../domain/metadata";
import type { LibraryScope } from "../domain/types";
import { readAttachment, type ZoteroAttachmentLike } from "./attachment-adapter";

export type ZoteroItemLike = {
  id: number;
  getField: (field: string) => string;
  getCreators?: () => Array<Record<string, string>>;
  getTags?: () => Array<{ tag: string }>;
  getNotes?: () => number[];
  getAttachments?: () => number[];
  hasTag?: (tag: string) => boolean;
  isRegularItem?: () => boolean;
  attachmentLastRead?: number | null;
};

export type ZoteroFacade = {
  Libraries: { userLibraryID: number };
  Items: {
    get: (id: number) => ZoteroItemLike | ZoteroAttachmentLike | null;
    getAll: (libraryID: number) => ZoteroItemLike[];
  };
  Collections: {
    get: (id: number) => {
      getChildItems: (recursive?: boolean) => number[];
      addItems?: (ids: number[]) => void;
    };
  };
  Reader: { open: (attachmentID: number, options?: Record<string, unknown>) => Promise<unknown> };
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
  const memoField = options.memoField || null;
  return {
    async list(scope) {
      const items = itemsForScope(zotero, scope);
      return Promise.all(items.map((item) => normalizeItem(zotero, item, memoField)));
    },

    async get(itemID) {
      const item = zotero.Items.get(itemID) as ZoteroItemLike | null;
      if (!item || !item.isRegularItem?.()) return null;
      return normalizeItem(zotero, item, memoField);
    },

    async addToCollection(itemIDs, collectionID) {
      const collection = zotero.Collections.get(collectionID);
      if (!collection.addItems) throw new Error("Collection cannot accept items");
      collection.addItems(itemIDs);
    },

    async openPDF(itemID, attachmentID) {
      const item = zotero.Items.get(itemID) as ZoteroItemLike | null;
      if (!item) throw new Error("Item not found");
      const chosen = attachmentID || selectPrimaryAttachment((await rawPaper(zotero, item)).attachments)?.id;
      if (!chosen) throw new Error("No PDF attachment");
      await zotero.Reader.open(chosen);
    },
  };
}

function itemsForScope(zotero: ZoteroFacade, scope: LibraryScope): ZoteroItemLike[] {
  const all = () =>
    zotero.Items.getAll(zotero.Libraries.userLibraryID).filter((item) => item.isRegularItem?.());
  if (scope.kind === "library") return all();
  if (scope.kind === "tag") return all().filter((item) => item.hasTag?.(scope.tag));
  return zotero.Collections.get(scope.collectionID)
    .getChildItems(true)
    .map((id) => zotero.Items.get(id) as ZoteroItemLike)
    .filter((item) => Boolean(item?.isRegularItem?.()));
}

async function normalizeItem(
  zotero: ZoteroFacade,
  item: ZoteroItemLike,
  memoField: string | null,
): Promise<PaperDTO> {
  return normalizePaper(await rawPaper(zotero, item), memoField);
}

async function rawPaper(zotero: ZoteroFacade, item: ZoteroItemLike): Promise<RawPaper> {
  const attachmentIDs = item.getAttachments?.() || [];
  const attachments = await Promise.all(
    attachmentIDs
      .map((id) => zotero.Items.get(id))
      .filter(Boolean)
      .map((attachment) => readAttachment(attachment as ZoteroAttachmentLike)),
  );
  const fields: Record<string, string> = {};
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
    attachmentLastRead: item.attachmentLastRead ?? null,
  };
}

async function readNotes(zotero: ZoteroFacade, noteIDs: number[]): Promise<string[]> {
  return noteIDs
    .map((id) => zotero.Items.get(id) as (ZoteroItemLike & { getNote?: () => string }) | null)
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
