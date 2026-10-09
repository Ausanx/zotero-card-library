import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { formatDetailAuthors } from "../../src/ui/detail-view";

describe("detail view", () => {
  it("formats missing and multiple authors without adding placeholder fields", () => {
    assert.equal(formatDetailAuthors([]), "作者未知");
    assert.equal(
      formatDetailAuthors(["Ada Lovelace", "Grace Hopper"]),
      "Ada Lovelace；Grace Hopper",
    );
  });
});
