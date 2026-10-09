import type { CoverEngine } from "./pdf-adapter";

export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type PdfGraphic = {
  bbox: [number, number, number, number];
  kind?: "image" | "path" | "background" | "noise" | string;
};

export type PdfPageSnapshot = {
  page: number;
  width: number;
  height: number;
  textItems: PdfTextItem[];
  graphics: PdfGraphic[];
};

export type FigureCandidate = {
  attachmentID: number;
  page: number;
  bbox: [number, number, number, number];
  caption: string;
  score: number;
  previewPath: string | null;
};

type Caption = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const CAPTION_PATTERN =
  /^(?:fig(?:ure)?s?\.?\s*\d+[a-z]?|图\s*\d+[a-z]?)(?:\s*[:.：-]|\s|$)/iu;
const KEYWORD_PATTERN =
  /\b(?:overview|framework|architecture|system|pipeline|model|workflow|results?)\b|(?:概览|框架|架构|系统|流程|模型|结果)/iu;

export function findFigureCandidates(
  attachmentID: number,
  pages: PdfPageSnapshot[],
): FigureCandidate[] {
  const candidates: FigureCandidate[] = [];
  for (const page of pages) {
    if (!isValidPage(page)) continue;
    const captions = findCaptions(page.textItems);
    if (!captions.length) continue;
    for (const caption of captions) {
      const graphic = nearestGraphic(page, caption);
      if (!graphic) continue;
      const bbox = clampBBox(graphic.bbox, page.width, page.height);
      if (!isUsefulGraphic(bbox, page.width, page.height, graphic.kind))
        continue;
      const gap = verticalGap(caption, graphic.bbox);
      const score = scoreCandidate(
        caption.text,
        graphic.kind,
        gap,
        bbox,
        page.width,
        page.height,
      );
      candidates.push({
        attachmentID,
        page: page.page,
        bbox: normalizeBBox(bbox, page.width, page.height),
        caption: caption.text.trim(),
        score,
        previewPath: null,
      });
    }
  }
  return deduplicateCandidates(candidates)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

export class LocalCandidateEngine {
  constructor(private readonly pdf: CoverEngine) {}

  async findCandidates(attachmentID: number, mode: "visible-card" | "detail") {
    const pages = await this.pdf.inspect(attachmentID);
    return findFigureCandidates(attachmentID, pages);
  }
}

function findCaptions(items: PdfTextItem[]): Caption[] {
  return items
    .map((item) => ({
      text: item.text.trim(),
      x: item.x,
      y: item.y,
      width: Math.max(item.width || 0, 1),
      height: Math.max(item.height || 0, 1),
    }))
    .filter((item) => item.text.length > 0 && CAPTION_PATTERN.test(item.text));
}

function nearestGraphic(
  page: PdfPageSnapshot,
  caption: Caption,
): PdfGraphic | null {
  const peers = findCaptions(page.textItems).filter(
    (other) => Math.abs(other.y - caption.y) < 60,
  );
  const previous = peers
    .filter((other) => other.x < caption.x)
    .sort((a, b) => b.x - a.x)[0];
  const next = peers
    .filter((other) => other.x > caption.x)
    .sort((a, b) => a.x - b.x)[0];
  const leftBound = previous
    ? (previous.x + previous.width + caption.x) / 2
    : 0;
  const rightBound = next
    ? (caption.x + caption.width + next.x) / 2
    : page.width;
  const usable = page.graphics.filter((graphic) => {
    const center = (graphic.bbox[0] + graphic.bbox[2]) / 2;
    return (
      center >= leftBound &&
      center <= rightBound &&
      isUsefulGraphic(graphic.bbox, page.width, page.height, graphic.kind)
    );
  });
  let best: { graphic: PdfGraphic; distance: number } | null = null;
  for (const graphic of usable) {
    if (!Array.isArray(graphic.bbox) || graphic.bbox.length !== 4) continue;
    if (graphic.kind === "background" || graphic.kind === "noise") continue;
    const distance = graphicDistance(graphic.bbox, caption);
    if (distance > Math.max(page.height * 0.35, 180)) continue;
    if (!best || distance < best.distance) best = { graphic, distance };
  }
  if (!best) return null;
  let bbox = [...best.graphic.bbox] as [number, number, number, number];
  const included = new Set([best.graphic]);
  for (let pass = 0; pass < usable.length; pass++) {
    let grew = false;
    for (const graphic of usable) {
      if (included.has(graphic)) continue;
      const b = graphic.bbox;
      const dx = Math.max(0, bbox[0] - b[2], b[0] - bbox[2]);
      const dy = Math.max(0, bbox[1] - b[3], b[1] - bbox[3]);
      if (
        dx > Math.min(60, page.width * 0.1) ||
        dy > 24 ||
        b[3] > caption.y + 20
      )
        continue;
      bbox = [
        Math.min(bbox[0], b[0]),
        Math.min(bbox[1], b[1]),
        Math.max(bbox[2], b[2]),
        Math.max(bbox[3], b[3]),
      ];
      included.add(graphic);
      grew = true;
    }
    if (!grew) break;
  }
  return { bbox, kind: best.graphic.kind };
}

function graphicDistance(
  bbox: [number, number, number, number],
  caption: Caption,
): number {
  const [left, bottom, right, top] = bbox;
  const captionCenter = caption.x + caption.width / 2;
  const horizontal =
    captionCenter < left
      ? left - captionCenter
      : captionCenter > right
        ? captionCenter - right
        : 0;
  const vertical =
    caption.y < bottom
      ? bottom - caption.y
      : caption.y > top
        ? caption.y - top
        : 0;
  return Math.hypot(horizontal * 0.35, vertical);
}

function verticalGap(
  caption: Caption,
  bbox: [number, number, number, number],
): number {
  if (caption.y < bbox[1]) return bbox[1] - caption.y;
  if (caption.y > bbox[3]) return caption.y - bbox[3];
  return 0;
}

function scoreCandidate(
  caption: string,
  kind: string | undefined,
  gap: number,
  bbox: [number, number, number, number],
  width: number,
  height: number,
): number {
  let score = 1;
  if (/^\s*(?:fig(?:ure)?s?\.?\s*1|图\s*1)/iu.test(caption)) score += 0.3;
  if (KEYWORD_PATTERN.test(caption)) score += 0.25;
  if (kind === "image") score += 0.35;
  if (kind === "path") score += 0.12;
  score += Math.max(0, 0.2 - gap / Math.max(height, 1));
  const areaRatio =
    ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) / (width * height);
  score += Math.min(areaRatio, 0.2);
  return Number(score.toFixed(4));
}

function deduplicateCandidates(
  candidates: FigureCandidate[],
): FigureCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.page}:${candidate.bbox.map((value) => value.toFixed(3)).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isValidPage(page: PdfPageSnapshot): boolean {
  return (
    page.width > 0 &&
    page.height > 0 &&
    Number.isFinite(page.width) &&
    Number.isFinite(page.height)
  );
}

function isUsefulGraphic(
  bbox: [number, number, number, number],
  width: number,
  height: number,
  kind: string | undefined,
): boolean {
  const area = Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
  const ratio = area / (width * height);
  if (kind === "background" || kind === "noise") return false;
  return ratio >= 0.01 && ratio < 0.8 && bbox[2] > bbox[0] && bbox[3] > bbox[1];
}

function clampBBox(
  bbox: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] {
  return [
    Math.max(0, Math.min(width, bbox[0])),
    Math.max(0, Math.min(height, bbox[1])),
    Math.max(0, Math.min(width, bbox[2])),
    Math.max(0, Math.min(height, bbox[3])),
  ];
}

function normalizeBBox(
  bbox: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] {
  return [bbox[0] / width, bbox[1] / height, bbox[2] / width, bbox[3] / height];
}
