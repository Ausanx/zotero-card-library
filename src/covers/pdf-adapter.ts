import type {
  PdfPageSnapshot,
  PdfTextItem,
  PdfGraphic,
} from "./candidate-engine";
import { validateNormalizedCrop, type BBox } from "./manual-crop";

type Viewport = { width: number; height: number; transform?: number[] };
export type PdfPageLike = {
  getViewport(options: { scale: number }): Viewport;
  getTextContent(): Promise<{ items: Array<Record<string, unknown>> }>;
  getOperatorList?(): Promise<{ fnArray?: number[]; argsArray?: unknown[] }>;
  render(options: Record<string, unknown>): { promise: Promise<unknown> };
};
export type PdfDocumentLike = {
  numPages: number;
  getPage(page: number): Promise<PdfPageLike>;
  destroy?(): Promise<void>;
};
export type PdfDocumentLoader = (
  attachmentID: number,
) => Promise<PdfDocumentLike>;
export type CoverEngine = {
  inspect(attachmentID: number, maxPages?: number): Promise<PdfPageSnapshot[]>;
  renderRegion(attachmentID: number, page: number, bbox: BBox): Promise<string>;
  renderFirstPage(attachmentID: number): Promise<string>;
};
// Operator identifiers are from Zotero 9.0.6's bundled PDF.js OPS export.
const OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  formBegin: 74,
  formEnd: 75,
  imageMask: 83,
  image: 85,
  inlineImage: 86,
  constructPath: 91,
};
const identity = [1, 0, 0, 1, 0, 0];

export function createPdfAdapter(
  load: PdfDocumentLoader,
  documentFactory: () => Document | null = () => null,
): CoverEngine {
  const render = async (id: number, page: number, bbox: BBox) =>
    renderPageRegion(
      await (await load(id)).getPage(page),
      bbox,
      documentFactory,
    );
  return {
    async inspect(id, maxPages) {
      const pdf = await load(id);
      const pages: PdfPageSnapshot[] = [];
      for (
        let number = 1;
        number <= Math.min(pdf.numPages, maxPages || pdf.numPages);
        number++
      ) {
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        const matrix = viewport.transform || [1, 0, 0, -1, 0, viewport.height];
        const textItems = mergeTextLines(
          (await page.getTextContent()).items.flatMap((item): PdfTextItem[] => {
            if (typeof item.str !== "string" || !Array.isArray(item.transform))
              return [];
            const point = apply(
              matrix,
              Number(item.transform[4]),
              Number(item.transform[5]),
            );
            return [
              {
                text: item.str,
                x: point[0],
                y: point[1],
                width: Number(item.width) || 0,
                height: Number(item.height) || 10,
              },
            ];
          }),
        );
        // Text is inspected throughout the document; expensive drawing data is read only on caption pages.
        const hasCaption = textItems.some((item) =>
          /^(fig(?:ure)?s?\.?\s*\d|图\s*\d)/iu.test(item.text.trim()),
        );
        const graphics =
          hasCaption && page.getOperatorList
            ? readGraphics(await page.getOperatorList(), matrix)
            : [];
        pages.push({
          page: number,
          width: viewport.width,
          height: viewport.height,
          textItems,
          graphics,
        });
      }
      return pages;
    },
    renderRegion: render,
    renderFirstPage: (id) => render(id, 1, [0, 0, 1, 1]),
  };
}

function mergeTextLines(items: PdfTextItem[]): PdfTextItem[] {
  const result: PdfTextItem[] = [];
  for (const item of items.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = result[result.length - 1];
    if (
      last &&
      Math.abs(last.y - item.y) <= 2 &&
      item.x - last.x - (last.width || 0) < 16 &&
      item.x >= last.x
    ) {
      last.text += ` ${item.text}`;
      last.width = item.x + (item.width || 0) - last.x;
    } else result.push({ ...item });
  }
  return result;
}

function readGraphics(
  list: { fnArray?: number[]; argsArray?: unknown[] },
  viewport: number[],
): PdfGraphic[] {
  const graphics: PdfGraphic[] = [];
  const stack: number[][] = [];
  let ctm = identity;
  for (let i = 0; i < (list.fnArray?.length || 0); i++) {
    const op = list.fnArray![i];
    const args = (list.argsArray?.[i] || []) as any[];
    if (op === OPS.save || op === OPS.formBegin) {
      stack.push(ctm);
      if (op === OPS.formBegin && args[0]) ctm = multiply(ctm, args[0]);
    } else if (op === OPS.restore || op === OPS.formEnd)
      ctm = stack.pop() || identity;
    else if (op === OPS.transform) ctm = multiply(ctm, args as number[]);
    else if ([OPS.image, OPS.inlineImage, OPS.imageMask].includes(op)) {
      graphics.push({
        kind: "image",
        bbox: transformBox([0, 0, 1, 1], multiply(viewport, ctm)),
      });
    } else if (op === OPS.constructPath && args[2]?.length === 4) {
      graphics.push({
        kind: "path",
        bbox: transformBox(
          Array.from(args[2]) as BBox,
          multiply(viewport, ctm),
        ),
      });
    }
  }
  return graphics.filter((g) => g.bbox.every(Number.isFinite));
}
function multiply(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function apply(m: number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function transformBox(b: BBox, m: number[]): BBox {
  const points = [
    apply(m, b[0], b[1]),
    apply(m, b[2], b[1]),
    apply(m, b[0], b[3]),
    apply(m, b[2], b[3]),
  ];
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
async function renderPageRegion(
  page: PdfPageLike,
  bbox: BBox,
  documentFactory: () => Document | null,
): Promise<string> {
  validateNormalizedCrop(bbox);
  const document = documentFactory();
  if (!document) throw new Error("Canvas document is unavailable");
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(
    2,
    1400 / (base.width * (bbox[2] - bbox[0])),
    1600 / (base.height * (bbox[3] - bbox[1])),
  );
  const viewport = page.getViewport({ scale });
  const canvas = document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "canvas",
  ) as HTMLCanvasElement;
  canvas.width = Math.max(1, Math.round((bbox[2] - bbox[0]) * viewport.width));
  canvas.height = Math.max(
    1,
    Math.round((bbox[3] - bbox[1]) * viewport.height),
  );
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable");
  await page.render({
    canvasContext: context,
    viewport,
    transform: [
      1,
      0,
      0,
      1,
      -bbox[0] * viewport.width,
      -bbox[1] * viewport.height,
    ],
    background: "rgb(255,255,255)",
  }).promise;
  const url = canvas.toDataURL("image/png");
  canvas.width = canvas.height = 0;
  return url;
}
