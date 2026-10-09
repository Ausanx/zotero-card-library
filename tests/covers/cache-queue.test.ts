import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { createCoverCache } from "../../src/covers/cache";
import { RenderQueue } from "../../src/covers/render-queue";

describe("cover rendering support", () => {
  it("keys cached regions by attachment fingerprint and invalidates stale entries", () => {
    const cache = createCoverCache();
    const key = { attachmentID: 4, fingerprint: "a", page: 1, bbox: [0, 0, 1, 1] as [number, number, number, number] };
    cache.set(key, "data:image/png;base64,a");
    assert.equal(cache.get(key), "data:image/png;base64,a");
    assert.equal(cache.get({ ...key, fingerprint: "b" }), null);
    cache.invalidateAttachment(4, "a");
    assert.equal(cache.get(key), null);
  });

  it("runs visible work before background work", async () => {
    const queue = new RenderQueue(1);
    const order: string[] = [];
    const first = queue.enqueue(async () => {
      order.push("first");
      return "first";
    });
    const background = queue.enqueue(async () => {
      order.push("background");
      return "background";
    }, 0);
    const visible = queue.enqueue(async () => {
      order.push("visible");
      return "visible";
    }, 10);
    assert.deepEqual(await Promise.all([first, background, visible]), ["first", "background", "visible"]);
    assert.deepEqual(order, ["first", "visible", "background"]);
  });
});
