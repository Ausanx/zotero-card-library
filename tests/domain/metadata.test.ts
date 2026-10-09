import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  normalizePaper,
  selectPrimaryAttachment,
  type RawPaper,
} from "../../src/domain/metadata";

describe("paper metadata", () => {
  it("normalizes core fields and a configured memo field", () => {
    const paper: RawPaper = {
      id: 12,
      title: "A card-ready paper",
      creators: [
        { firstName: "Ada", lastName: "Lovelace", creatorType: "author" },
        { firstName: "Grace", lastName: "Hopper", creatorType: "author" },
      ],
      publicationTitle: "Journal of Cards",
      date: "2024-05-01",
      DOI: "10.1000/example",
      abstractNote: "An abstract",
      tags: [{ tag: "important" }],
      notes: ["A note"],
      fields: { extra: "", shortTitle: "Memo text" },
      attachments: [
        {
          id: 19,
          contentType: "application/pdf",
          path: "C:/paper.pdf",
          isPrimary: true,
        },
      ],
      attachmentLastRead: 123,
    };

    assert.deepEqual(normalizePaper(paper, "shortTitle"), {
      itemID: 12,
      title: "A card-ready paper",
      authors: ["Ada Lovelace", "Grace Hopper"],
      publication: "Journal of Cards",
      year: "2024",
      doi: "10.1000/example",
      abstract: "An abstract",
      tags: ["important"],
      notes: ["A note"],
      memo: "Memo text",
      attachmentID: 19,
      attachmentPath: "C:/paper.pdf",
      lastRead: 123,
      attachments: [
        { id: 19, label: "paper.pdf", path: "C:/paper.pdf" },
      ],
    });
  });

  it("chooses the primary PDF deterministically and ignores non-PDF files", () => {
    const attachments = [
      { id: 30, contentType: "text/plain", path: "notes.txt" },
      { id: 22, contentType: "application/pdf", path: "preprint.pdf" },
      { id: 25, contentType: "application/pdf", path: "published.pdf", isPrimary: true },
    ];
    assert.equal(selectPrimaryAttachment(attachments)?.id, 25);
    assert.equal(selectPrimaryAttachment(attachments.slice(0, 2))?.id, 22);
  });

  it("keeps metadata when the PDF path is unavailable", () => {
    const paper: RawPaper = {
      id: 2,
      title: "No local file",
      creators: [],
      fields: {},
      attachments: [{ id: 3, contentType: "application/pdf", path: null }],
    };
    const normalized = normalizePaper(paper, null);
    assert.equal(normalized.title, "No local file");
    assert.equal(normalized.attachmentID, 3);
    assert.equal(normalized.attachmentPath, null);
  });
});
