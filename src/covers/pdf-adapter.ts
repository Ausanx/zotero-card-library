import type { PdfPageSnapshot, PdfTextItem, PdfGraphic } from "./candidate-engine";

export type PdfPageLike = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: Array<Record<string, unknown>> }>;
  getOperatorList?: () => Promise<{ fnArray?: number[]; argsArray?: unknown[] }>;
  render: (options: Record<string, unknown>) => { promise: Promise<unknown> };
};

export type PdfDocumentLike = {
  numPages: number;
  getPage: (page: number) => Promise<PdfPageLike>;
};

export type PdfDocumentLoader = (attachmentID: number) => Promise<PdfDocumentLike>;

export type CoverEngine = {
  inspect: (attachmentID: number, maxPages?: number) => Promise<PdfPageSnapshot[]>;
  renderRegion: (attachmentID: number, page: number, bbox: [number, number, number, number]) => Promise<string>;
  renderFirstPage: (attachmentID: number) => Promise<string>;
};

export function createPdfAdapter(load: PdfDocumentLoader, documentFactory: () => Document | null = () => null): CoverEngine {
  return {
    async inspect(attachmentID, maxPages) {
      const document = await load(attachmentID);
      const count = Math.min(document.numPages, maxPages || document.numPages);
      const pages: PdfPageSnapshot[] = [];
      for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
        pages.push(await inspectPage(await document.getPage(pageNumber), pageNumber));
      }
      return pages;
    },

    async renderRegion(attachmentID, pageNumber, bbox) {
      const document = await load(attachmentID);
      return renderPageRegion(await document.getPage(pageNumber), bbox, documentFactory);
    },

    async renderFirstPage(attachmentID) {
      const document = await load(attachmentID);
      const page = await document.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      return renderPageRegion(page, [0, 0, viewport.width, viewport.height], documentFactory);
    },
  };
}

async function inspectPage(page: PdfPageLike, pageNumber: number): Promise<PdfPageSnapshot> {
  const viewport = page.getViewport({ scale: 1 });
  const text = await page.getTextContent();
  const textItems: PdfTextItem[] = text.items
    .map((item) => toTextItem(item))
    .filter((item): item is PdfTextItem => Boolean(item));
  const graphics = page.getOperatorList ? await readGraphics(page, viewport) : [];
  return { page: pageNumber, width: viewport.width, height: viewport.height, textItems, graphics };
}

function toTextItem(item: Record<string, unknown>): PdfTextItem | null {
  const text = typeof item.str === "string" ? item.str.trim() : "";
  const transform = Array.isArray(item.transform) ? item.transform : [];
  if (!text || transform.length < 6 || typeof transform[4] !== "number" || typeof transform[5] !== "number") return null;
  return {
    text,
    x: transform[4],
    y: transform[5],
    width: typeof item.width === "number" ? item.width : undefined,
    height: typeof item.height === "number" ? item.height : undefined,
  };
}

async function readGraphics(page: PdfPageLike, viewport: { width: number; height: number }): Promise<PdfGraphic[]> {
  const list = await page.getOperatorList!();
  const graphics: PdfGraphic[] = [];
  const args = list.argsArray || [];
  for (const value of args) {
    if (!Array.isArray(value) || value.length < 4) continue;
    const numbers = value.filter((entry): entry is number => typeof entry === "number");
    if (numbers.length < 4) continue;
    const [x, y, width, height] = numbers;
    if (width <= 0 || height <= 0) continue;
    graphics.push({ bbox: [x, y, x + width, y + height], kind: "path" });
  }
  return graphics.filter((graphic) => {
    const area = (graphic.bbox[2] - graphic.bbox[0]) * (graphic.bbox[3] - graphic.bbox[1]);
    return area > viewport.width * viewport.height * 0.01;
  });
}

async function renderPageRegion(
  page: PdfPageLike,
  bbox: [number, number, number, number],
  documentFactory: () => Document | null,
): Promise<string> {
  const document = documentFactory();
  if (!document) throw new Error("Canvas document is unavailable");
  const scale = 1.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const left = Math.max(0, bbox[0]) * scale;
  const top = Math.max(0, bbox[1]) * scale;
  const right = Math.min(viewport.width / scale, bbox[2]) * scale;
  const bottom = Math.min(viewport.height / scale, bbox[3]) * scale;
  canvas.width = Math.max(1, Math.round(right - left));
  canvas.height = Math.max(1, Math.round(bottom - top));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable");
  await page.render({ canvasContext: context, viewport, transform: [1, 0, 0, 1, -left, -top] }).promise;
  return canvas.toDataURL("image/png");
}
