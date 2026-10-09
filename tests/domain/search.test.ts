import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { searchPapers, sortPapers } from "../../src/domain/search";
import { paper } from "../fixtures/paper";
describe("search and sorting", () => {
  it("searches metadata, memo and notes case-insensitively without mutating input", () => {
    for (const word of [
      "LONG",
      "ada",
      "nature",
      "abstract",
      "memo",
      "note",
      "tag",
    ])
      assert.equal(searchPapers([paper], word).length, 1);
    assert.equal(searchPapers([paper], "missing").length, 0);
  });
  it("sorts by addition date, reading time, year, title and author", () => {
    const items = [
      {
        ...paper,
        itemID: 1,
        title: "B",
        authors: ["Z"],
        dateAdded: "2025-01-01",
        year: "2024",
        lastRead: 20,
      },
      {
        ...paper,
        itemID: 2,
        title: "A",
        authors: ["A"],
        dateAdded: "2026-01-01",
        year: "2025",
        lastRead: 10,
      },
    ];
    for (const mode of ["recently-added", "year", "title", "author"])
      assert.deepEqual(
        sortPapers(items, mode).map((x) => x.itemID),
        [2, 1],
      );
    assert.deepEqual(
      sortPapers(items, "recently-opened").map((x) => x.itemID),
      [1, 2],
    );
    assert.equal(items[0].itemID, 1);
  });
});
