import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { createLibraryAdapter } from "../../src/zotero/library-adapter";

function fixture() {
  let inTransaction = false;
  const added: number[][] = [];
  const attachment = {
    id: 3,
    attachmentLastRead: 1700000000,
    attachmentContentType: "application/pdf",
    getFilePathAsync: async () => "paper.pdf",
    getField: () => "paper.pdf",
  };
  const item = {
    id: 1,
    libraryID: 10,
    isRegularItem: () => true,
    getAttachments: () => [3],
    getBestAttachment: async () => attachment,
    getCollections: () => [7],
    getField: (field: string) =>
      ({ title: "Paper", archive: "custom memo", dateAdded: "2025-01-01" })[
        field
      ] || "",
  };
  const zotero = {
    Libraries: { userLibraryID: 10 },
    Items: {
      getAll: async () => [item],
      get: (id: number) => (id === 1 ? item : attachment),
    },
    Collections: {
      get: () => ({
        libraryID: 10,
        editable: true,
        getChildItems: () => [1],
        addItems: async (ids: number[]) => {
          assert.ok(inTransaction);
          await Promise.resolve();
          added.push(ids);
        },
      }),
    },
    DB: {
      executeTransaction: async (fn: () => Promise<void>) => {
        inTransaction = true;
        try {
          await fn();
        } finally {
          inTransaction = false;
        }
      },
    },
    Reader: { open: async () => undefined },
  };
  return { zotero, added };
}

describe("Zotero 9 runtime contracts", () => {
  it("awaits getAll and reads arbitrary memo fields and attachment last-read seconds", async () => {
    const { zotero } = fixture();
    const papers = await createLibraryAdapter(zotero as any, {
      memoField: "archive",
    }).list({ kind: "library" });
    assert.equal(papers[0].memo, "custom memo");
    assert.equal(papers[0].lastRead, 1700000000000);
    assert.deepEqual(papers[0].collectionIDs, [7]);
  });
  it("awaits the explicit batch action inside a Zotero transaction", async () => {
    const { zotero, added } = fixture();
    await createLibraryAdapter(zotero as any).addToCollection([1], 7);
    assert.deepEqual(added, [[1]]);
  });
  it("rejects an attachment that does not belong to the requested paper", async () => {
    const { zotero } = fixture();
    await assert.rejects(
      createLibraryAdapter(zotero as any).openPDF(1, 999),
      /attachment/i,
    );
  });
});
