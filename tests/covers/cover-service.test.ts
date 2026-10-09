import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { CoverService } from "../../src/covers/cover-service";
describe("cover service", () => {
  it("restores a cached cover after reopening without opening the PDF", async () => {
    const cache = new Map<string, string>();
    const options = {
      pdf: {
        inspect: async () => [],
        renderRegion: async () => "cached-image",
        renderFirstPage: async () => "cached-image",
      },
      fingerprint: async () => "unchanged",
      pageCount: async () => 1,
      cache: {
        read: async (key: string) => cache.get(key) || null,
        write: async (key: string, value: string) => {
          cache.set(key, value);
        },
      },
    };
    const first = new CoverService(options);
    const cover = await first.getCover(3, null);
    first.dispose();
    const reopened = new CoverService({
      ...options,
      pageCount: async () => {
        throw new Error("PDF opened on a cache hit");
      },
    });
    assert.equal(
      (await reopened.getCover(3, cover.reference)).url,
      "cached-image",
    );
    reopened.dispose();
  });
  it("chooses an internal figure, reuses cached renders and invalidates on fingerprint changes", async () => {
    let stamp = "1",
      renders = 0;
    const cache = new Map<string, string>();
    const service = new CoverService({
      pdf: {
        inspect: async () => [
          {
            page: 1,
            width: 600,
            height: 800,
            textItems: [
              { text: "Figure 1. Overview", x: 80, y: 620, width: 400 },
            ],
            graphics: [{ kind: "image", bbox: [80, 200, 520, 580] }],
          },
        ],
        renderRegion: async () => `image${++renders}`,
        renderFirstPage: async () => "first",
      },
      fingerprint: async () => stamp,
      pageCount: async () => 1,
      cache: {
        read: async (key) => cache.get(key) || null,
        write: async (key, value) => {
          cache.set(key, value);
        },
      },
    });
    const first = await service.getCover(3, null);
    assert.equal(first.reference.source, "candidate");
    assert.equal(first.url, "image1");
    assert.equal((await service.getCover(3, first.reference)).url, "image1");
    stamp = "2";
    assert.equal((await service.getCover(3, first.reference)).url, "image2");
    service.dispose();
  });
  it("falls back only with no candidates and preserves manual crop references", async () => {
    const service = new CoverService({
      pdf: {
        inspect: async () => [],
        renderRegion: async () => "render",
        renderFirstPage: async () => "first",
      },
      fingerprint: async () => "1",
      pageCount: async () => 2,
    });
    assert.equal(
      (await service.getCover(3, null)).reference.source,
      "first-page",
    );
    const manual = await service.choose(3, 2, [0.1, 0.1, 0.7, 0.8], "manual");
    assert.equal(
      (await service.getCover(3, manual.reference)).reference.source,
      "manual",
    );
    await assert.rejects(service.choose(3, 9, [0, 0, 1, 1], "manual"), /page/i);
    service.dispose();
  });
});
