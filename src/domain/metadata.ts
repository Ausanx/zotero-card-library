import type { LibraryScope } from "./types";

export type RawCreator = {
  firstName?: string;
  lastName?: string;
  name?: string;
  creatorType?: string;
};

export type RawAttachment = {
  id: number;
  contentType?: string;
  path: string | null;
  filename?: string;
  isPrimary?: boolean;
};

export type RawPaper = {
  id: number;
  title?: string;
  creators?: RawCreator[];
  publicationTitle?: string;
  date?: string;
  DOI?: string;
  abstractNote?: string;
  tags?: Array<{ tag: string }>;
  notes?: string[];
  fields: Record<string, string | undefined>;
  attachments: RawAttachment[];
  attachmentLastRead?: number | null;
};

export type PaperAttachment = {
  id: number;
  label: string;
  path: string | null;
};

export type PaperDTO = {
  itemID: number;
  title: string;
  authors: string[];
  publication: string;
  year: string;
  doi: string;
  abstract: string;
  tags: string[];
  notes: string[];
  memo: string;
  attachmentID: number | null;
  attachmentPath: string | null;
  attachments: PaperAttachment[];
  lastRead: number | null;
};

export type { LibraryScope };

export function selectPrimaryAttachment(
  attachments: RawAttachment[],
): RawAttachment | null {
  const pdfs = attachments.filter(
    (attachment) =>
      attachment.contentType === "application/pdf" ||
      attachment.filename?.toLowerCase().endsWith(".pdf"),
  );
  return (
    pdfs.find((attachment) => attachment.isPrimary) ||
    [...pdfs].sort((left, right) => left.id - right.id)[0] ||
    null
  );
}

export function normalizePaper(
  paper: RawPaper,
  memoField: string | null,
): PaperDTO {
  const primary = selectPrimaryAttachment(paper.attachments);
  const attachments = paper.attachments
    .filter((attachment) => attachment.contentType === "application/pdf")
    .map((attachment) => ({
      id: attachment.id,
      label:
        attachment.filename ||
        attachment.path?.split(/[\\/]/).pop() ||
        `PDF ${attachment.id}`,
      path: attachment.path,
    }));

  return {
    itemID: paper.id,
    title: paper.title?.trim() || "Untitled",
    authors: (paper.creators || [])
      .filter((creator) => creator.creatorType === undefined || creator.creatorType === "author")
      .map(formatCreator)
      .filter(Boolean),
    publication: paper.publicationTitle?.trim() || "",
    year: paper.date?.match(/\d{4}/)?.[0] || "",
    doi: paper.DOI?.trim() || "",
    abstract: paper.abstractNote?.trim() || "",
    tags: (paper.tags || []).map((tag) => tag.tag).filter(Boolean),
    notes: paper.notes || [],
    memo: memoField ? paper.fields[memoField]?.trim() || "" : "",
    attachmentID: primary?.id || null,
    attachmentPath: primary?.path || null,
    attachments,
    lastRead: paper.attachmentLastRead ?? null,
  };
}

function formatCreator(creator: RawCreator): string {
  if (creator.name?.trim()) return creator.name.trim();
  return [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim();
}
