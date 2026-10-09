import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { createLibraryAdapter } from "../../src/zotero/library-adapter";

describe("library adapter", () => {
  it("automatically reads Style remarks in Extra and falls back to tagged notes", async () => {
    const items = [
      {
        id: 1,
        extra: "Citation Key: Example\nremark: DVS: 经典架构\nDOI: 10.1/x",
        notes: [11],
      },
      { id: 2, extra: "Citation Key: Other", notes: [12] },
      { id: 3, extra: "DOI: 10.1/z", notes: [13] },
    ].map(({ id, extra, notes }) => ({
      id,
      isRegularItem: () => true,
      getField: (field: string) =>
        field === "extra"
          ? extra
          : field === "shortTitle"
            ? "Explicit memo"
            : "",
      getNotes: () => notes,
    }));
    const notes = new Map([
      [
        11,
        {
          getTags: () => [{ tag: "remark" }],
          getNote: () => "<p>Old memo</p>",
        },
      ],
      [
        12,
        {
          getTags: () => [{ tag: "remark" }],
          getNote: () => "<div><p>Legacy memo</p><p>Second line</p></div>",
        },
      ],
      [13, { getTags: () => [], getNote: () => "<p>Ordinary note</p>" }],
    ]);
    const zotero = {
      Libraries: { userLibraryID: 1 },
      Items: { getAll: () => items, get: (id: number) => notes.get(id) },
      Utilities: {
        unescapeHTML: (html: string) => html.replace(/<[^>]*>/g, ""),
      },
    };
    const adapter = createLibraryAdapter(zotero as any);
    assert.deepEqual(
      (await adapter.list({ kind: "library" })).map((i) => i.memo),
      ["DVS: 经典架构", "Legacy memo\nSecond line", ""],
    );
    const explicit = createLibraryAdapter(zotero as any, {
      memoField: "shortTitle",
    });
    assert.equal(
      (await explicit.list({ kind: "library" }))[0].memo,
      "Explicit memo",
    );
  });
  it("lists regular library items and opens their primary PDF", async () => {
    const opened: number[] = [];
    const attachment = {
      id: 2,
      attachmentContentType: "application/pdf",
      getField: (field: string) => (field === "title" ? "paper.pdf" : ""),
      getFilePathAsync: async () => "C:/paper.pdf",
    };
    const item = {
      id: 1,
      isRegularItem: () => true,
      getField: (field: string) => (field === "title" ? "Paper" : ""),
      getAttachments: () => [2],
      getCreators: () => [],
      getTags: () => [],
    };
    const zotero = {
      Libraries: { userLibraryID: 10 },
      Items: {
        getAll: () => [item],
        get: (id: number) => (id === 1 ? item : id === 2 ? attachment : null),
      },
      Collections: { get: () => ({ getChildItems: () => [1] }) },
      Reader: { open: async (id: number) => void opened.push(id) },
    };
    const adapter = createLibraryAdapter(zotero);
    const papers = await adapter.list({ kind: "library" });
    assert.equal(papers[0].title, "Paper");
    await adapter.openPDF(1);
    assert.deepEqual(opened, [2]);
  });

  it("reads the configured memo field without assuming its name", async () => {
    const item = {
      id: 1,
      isRegularItem: () => true,
      getField: (field: string) =>
        field === "title" ? "Paper" : field === "shortTitle" ? "A memo" : "",
      getAttachments: () => [],
    };
    const zotero = {
      Libraries: { userLibraryID: 10 },
      Items: { getAll: () => [item], get: () => item },
      Collections: { get: () => ({ getChildItems: () => [] }) },
      Reader: { open: async () => undefined },
    };
    const adapter = createLibraryAdapter(zotero, { memoField: "shortTitle" });
    assert.equal((await adapter.list({ kind: "library" }))[0].memo, "A memo");
  });

  it("opens the deterministic primary PDF when attachments are not ordered", async () => {
    const opened: number[] = [];
    const makeAttachment = (id: number) => ({
      id,
      attachmentContentType: "application/pdf",
      getField: (field: string) => (field === "title" ? `${id}.pdf` : ""),
      getFilePathAsync: async () => `C:/${id}.pdf`,
    });
    const item = {
      id: 1,
      isRegularItem: () => true,
      getField: (field: string) => (field === "title" ? "Paper" : ""),
      getAttachments: () => [3, 2],
    };
    const zotero = {
      Libraries: { userLibraryID: 10 },
      Items: {
        getAll: () => [item],
        get: (id: number) => (id === 1 ? item : makeAttachment(id)),
      },
      Collections: { get: () => ({ getChildItems: () => [] }) },
      Reader: { open: async (id: number) => void opened.push(id) },
    };

    await createLibraryAdapter(zotero).openPDF(1);
    assert.deepEqual(opened, [2]);
  });
});
