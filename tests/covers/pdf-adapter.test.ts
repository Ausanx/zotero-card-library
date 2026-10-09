import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { createPdfAdapter, type PdfDocumentLike } from "../../src/covers/pdf-adapter";

describe("PDF.js adapter", () => {
  it("converts PDF.js text items and limits visible-card inspection", async () => {
    const pages = [1, 2, 3].map((pageNumber) => ({
      getViewport: () => ({ width: 600, height: 800 }),
      getTextContent: async () => ({
        items: [
          { str: `Figure ${pageNumber}. Caption`, transform: [1, 0, 0, 1, 80, 600], width: 160, height: 12 },
        ],
      }),
      getOperatorList: async () => ({ argsArray: [[80, 100, 440, 420]] }),
      render: () => ({ promise: Promise.resolve() }),
    }));
    const document: PdfDocumentLike = { numPages: 3, getPage: async (page) => pages[page - 1] };
    const adapter = createPdfAdapter(async () => document);

    const inspected = await adapter.inspect(12, 2);

    assert.equal(inspected.length, 2);
    assert.equal(inspected[0].textItems[0].text, "Figure 1. Caption");
    assert.deepEqual(inspected[0].graphics[0].bbox, [80, 100, 520, 520]);
  });
});
