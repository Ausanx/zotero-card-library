import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  createPdfAdapter,
  type PdfDocumentLike,
} from "../../src/covers/pdf-adapter";

describe("PDF.js adapter", () => {
  it("converts PDF.js text items and limits visible-card inspection", async () => {
    const pages = [1, 2, 3].map((pageNumber) => ({
      getViewport: () => ({
        width: 600,
        height: 800,
        transform: [1, 0, 0, -1, 0, 800],
      }),
      getTextContent: async () => ({
        items: [
          {
            str: `Figure ${pageNumber}. Caption`,
            transform: [1, 0, 0, 1, 80, 600],
            width: 160,
            height: 12,
          },
        ],
      }),
      getOperatorList: async () => ({
        fnArray: [10, 12, 85, 11],
        argsArray: [[], [440, 0, 0, 420, 80, 280], ["img1"], []],
      }),
      render: () => ({ promise: Promise.resolve() }),
    }));
    const document: PdfDocumentLike = {
      numPages: 3,
      getPage: async (page) => pages[page - 1],
    };
    const adapter = createPdfAdapter(async () => document);

    const inspected = await adapter.inspect(12, 2);

    assert.equal(inspected.length, 2);
    assert.equal(inspected[0].textItems[0].text, "Figure 1. Caption");
    assert.deepEqual(inspected[0].graphics[0].bbox, [80, 100, 520, 520]);
    assert.equal(inspected[0].textItems[0].y, 200);
  });
  it("renders normalized top-left regions at the requested position", async () => {
    let renderOptions: any;
    let renderedWidth = 0,
      renderedHeight = 0;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toDataURL: () => {
        renderedWidth = canvas.width;
        renderedHeight = canvas.height;
        return "data:image/png;base64,x";
      },
    };
    const adapter = createPdfAdapter(
      async () => ({
        numPages: 1,
        getPage: async () => ({
          getViewport: ({ scale }) => ({
            width: 600 * scale,
            height: 800 * scale,
          }),
          getTextContent: async () => ({ items: [] }),
          render: (options) => {
            renderOptions = options;
            return { promise: Promise.resolve() };
          },
        }),
      }),
      () =>
        ({ createElementNS: () => canvas, createElement: () => canvas }) as any,
    );
    await adapter.renderRegion(1, 1, [0.1, 0.25, 0.9, 0.75]);
    assert.ok(renderedWidth >= 480 && renderedHeight >= 400);
    assert.equal(renderedWidth / renderedHeight, 1.2);
    assert.equal(
      renderOptions.transform[4] / renderOptions.viewport.width,
      -0.1,
    );
    assert.equal(
      renderOptions.transform[5] / renderOptions.viewport.height,
      -0.25,
    );
  });
});
