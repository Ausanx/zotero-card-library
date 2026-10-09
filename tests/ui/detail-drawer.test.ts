import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  clampDetailWidth,
  formatDetailAuthors,
} from "../../src/ui/detail-drawer";

describe("detail drawer", () => {
  it("clamps a dragged width to a usable range", () => {
    assert.equal(clampDetailWidth(100), 320);
    assert.equal(clampDetailWidth(640), 640);
    assert.equal(clampDetailWidth(1200), 760);
  });

  it("formats missing and multiple authors without adding placeholder fields", () => {
    assert.equal(formatDetailAuthors([]), "作者未知");
    assert.equal(
      formatDetailAuthors(["Ada Lovelace", "Grace Hopper"]),
      "Ada Lovelace；Grace Hopper",
    );
  });
});
