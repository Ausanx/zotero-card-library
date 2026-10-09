import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  resolveColor,
  transitionReadingStatus,
} from "../../src/domain/color-rules";
import { defaultCardState } from "../../src/data/state-store";
import { paper } from "../fixtures/paper";
describe("local colors and status", () => {
  it("resolves overrides before tags before collections, preserving rule order", () => {
    const rules = [
      { source: "collection" as const, value: "7", color: "blue", priority: 0 },
      { source: "tag" as const, value: "tag", color: "orange", priority: 1 },
      { source: "tag" as const, value: "tag", color: "gray", priority: 2 },
    ];
    assert.equal(resolveColor(paper, defaultCardState(), rules), "orange");
    assert.equal(
      resolveColor({ ...paper, tags: [] }, defaultCardState(), rules),
      "blue",
    );
    assert.equal(
      resolveColor(
        paper,
        { ...defaultCardState(), colorOverride: "teal" },
        rules,
      ),
      "teal",
    );
  });
  it("only opens unread papers as reading and never infers completion", () => {
    assert.equal(transitionReadingStatus("unread", "pdf-opened"), "reading");
    assert.equal(transitionReadingStatus("read", "pdf-opened"), "read");
    assert.equal(transitionReadingStatus("reading", "mark-read"), "read");
  });
});
