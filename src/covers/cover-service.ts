import type { CoverReference, CoverSource } from "../domain/types";
import { findFigureCandidates, type FigureCandidate } from "./candidate-engine";
import type { CoverEngine } from "./pdf-adapter";
import { validateNormalizedCrop, type BBox } from "./manual-crop";
import { RenderQueue } from "./render-queue";

export type CoverResult = { reference: CoverReference; url: string };
export type CoverStorage = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
};
export type CoverServiceOptions = {
  pdf: CoverEngine;
  fingerprint(id: number): Promise<string>;
  pageCount(id: number): Promise<number>;
  cache?: CoverStorage;
  dispose?: () => void;
};

export class CoverService {
  private readonly queue = new RenderQueue(1);
  private disposed = false;
  private readonly memory = new Map<string, string>();
  constructor(private readonly options: CoverServiceOptions) {}

  getCover(id: number, reference: CoverReference | null): Promise<CoverResult> {
    return this.run(async () => {
      const stamp = await this.options.fingerprint(id);
      if (reference?.attachmentID === id)
        return this.render(
          id,
          stamp,
          reference.page,
          reference.bbox,
          reference.source,
        );
      const candidates = await this.candidates(id, stamp);
      const first = candidates[0];
      return first
        ? this.render(id, stamp, first.page, first.bbox, "candidate")
        : this.render(id, stamp, 1, [0, 0, 1, 1], "first-page");
    });
  }
  getCandidates(id: number): Promise<FigureCandidate[]> {
    return this.run(async () => {
      const stamp = await this.options.fingerprint(id);
      const candidates = await this.candidates(id, stamp);
      const result: FigureCandidate[] = [];
      for (const candidate of candidates)
        result.push({
          ...candidate,
          previewPath: (
            await this.render(
              id,
              stamp,
              candidate.page,
              candidate.bbox,
              "candidate",
            )
          ).url,
        });
      return result;
    });
  }
  choose(
    id: number,
    page: number,
    bbox: BBox,
    source: CoverSource,
  ): Promise<CoverResult> {
    return this.run(async () =>
      this.render(id, await this.options.fingerprint(id), page, bbox, source),
    );
  }
  pagePreview(
    id: number,
    page: number,
  ): Promise<{ url: string; pageCount: number }> {
    return this.run(async () => {
      const rendered = await this.render(
        id,
        await this.options.fingerprint(id),
        page,
        [0, 0, 1, 1],
        "first-page",
      );
      return { url: rendered.url, pageCount: await this.options.pageCount(id) };
    });
  }
  dispose(): void {
    this.disposed = true;
    this.queue.clear();
    this.memory.clear();
    this.options.dispose?.();
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("Cover service closed"));
    return this.queue.enqueue(fn);
  }
  private async read(key: string): Promise<string | null> {
    return (
      this.memory.get(key) || (await this.options.cache?.read(key)) || null
    );
  }
  private async write(key: string, value: string): Promise<void> {
    if (this.disposed) return;
    this.memory.set(key, value);
    // Keep bounded preview memory; the disk cache remains available.
    if (this.memory.size > 80)
      this.memory.delete(this.memory.keys().next().value!);
    await this.options.cache?.write(key, value);
  }
  private async candidates(
    id: number,
    stamp: string,
  ): Promise<FigureCandidate[]> {
    const key = `candidates-v2:${id}:${stamp}`;
    const cached = await this.read(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* rebuild corrupt cache */
      }
    }
    const candidates = findFigureCandidates(
      id,
      await this.options.pdf.inspect(id),
    );
    await this.write(key, JSON.stringify(candidates));
    return candidates;
  }
  private async render(
    id: number,
    stamp: string,
    page: number,
    bbox: BBox,
    source: CoverSource,
  ): Promise<CoverResult> {
    validateNormalizedCrop(bbox);
    if (!Number.isInteger(page) || page < 1)
      throw new Error("Invalid PDF page");
    const cacheKey = `region-v2:${id}:${stamp}:${page}:${bbox.map((n) => n.toFixed(5)).join(",")}`;
    let url = await this.read(cacheKey);
    if (!url) {
      if (page > (await this.options.pageCount(id)))
        throw new Error("Invalid PDF page");
      url = await this.options.pdf.renderRegion(id, page, bbox);
      await this.write(cacheKey, url);
    }
    return {
      url,
      reference: { attachmentID: id, source, page, bbox, cacheKey },
    };
  }
}
