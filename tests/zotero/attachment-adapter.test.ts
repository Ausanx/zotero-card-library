import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { readAttachment } from "../../src/zotero/attachment-adapter";

describe("attachment adapter", () => {
  it("reads a local PDF path and preserves the attachment title", async () => {
    const attachment = {
      id: 4,
      attachmentContentType: "application/pdf",
      getField: (field: string) => (field === "title" ? "paper.pdf" : ""),
      getFilePathAsync: async () => "C:/paper.pdf",
    };
    assert.deepEqual(await readAttachment(attachment), {
      id: 4,
      contentType: "application/pdf",
      path: "C:/paper.pdf",
      filename: "paper.pdf",
    });
  });

  it("returns a null path when the linked file is unavailable", async () => {
    const attachment = {
      id: 5,
      isPDFAttachment: () => true,
      getFilePathAsync: async () => false as const,
    };
    assert.equal((await readAttachment(attachment)).path, null);
  });
});
