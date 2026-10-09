import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  normalizeManualCrop,
  validateNormalizedCrop,
} from "../../src/covers/manual-crop";

describe("manual crop", () => {
  it("normalizes a page-space rectangle to [0, 1]", () => {
    assert.deepEqual(normalizeManualCrop([100, 50, 500, 450], 600, 800), [
      1 / 6,
      1 / 16,
      5 / 6,
      9 / 16,
    ]);
  });

  it("rejects reversed, out-of-range, and tiny rectangles", () => {
    assert.throws(
      () => normalizeManualCrop([500, 100, 100, 400], 600, 800),
      /ordered/,
    );
    assert.throws(
      () => normalizeManualCrop([-1, 100, 100, 400], 600, 800),
      /bounds/,
    );
    assert.throws(() => validateNormalizedCrop([0.1, 0.1, 0.11, 0.8]), /small/);
  });

  it("accepts a normalized crop and clamps no values silently", () => {
    assert.deepEqual(
      validateNormalizedCrop([0.05, 0.1, 0.95, 0.8]),
      [0.05, 0.1, 0.95, 0.8],
    );
    assert.throws(() => validateNormalizedCrop([0, 0, 1.01, 0.8]), /bounds/);
  });
});
