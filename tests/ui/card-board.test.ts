import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { computeColumnCount, getCardSummary } from "../../src/ui/card-board";

describe("card board", () => {
  it("uses two to five columns as the available board width changes", () => {
    assert.equal(computeColumnCount(600), 2);
    assert.equal(computeColumnCount(980), 3);
    assert.equal(computeColumnCount(1500), 5);
    assert.equal(computeColumnCount(1500, 500), 3);
  });

  it("keeps the compact card summary to title, authors, publication and year", () => {
    assert.deepEqual(
      getCardSummary({
        title: "  A paper  ",
        authors: ["Ada Lovelace", "Grace Hopper"],
        publication: "Journal of Cards",
        year: "2024",
      }),
      {
        title: "A paper",
        authors: "Ada Lovelace, Grace Hopper",
        publication: "Journal of Cards",
        year: "2024",
      },
    );
  });
});
