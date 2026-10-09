import type { PaperDTO } from "../../src/domain/metadata";
export const paper: PaperDTO = {
  itemID: 1,
  title: "A long paper title",
  authors: ["Ada"],
  publication: "Nature",
  year: "2025",
  doi: "10.1/x",
  abstract: "abstract",
  memo: "memo",
  notes: ["note"],
  tags: ["tag"],
  collectionIDs: [7],
  attachments: [{ id: 3, label: "paper.pdf", path: null }],
  attachmentID: 3,
  attachmentPath: null,
  lastRead: null,
};
