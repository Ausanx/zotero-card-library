import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import { renderCard } from "../../src/ui/card-view";
import { defaultCardState } from "../../src/data/state-store";
import type { PaperDTO } from "../../src/domain/metadata";

export const paper: PaperDTO = {
  itemID: 1,
  title: "A long paper title",
  authors: ["Ada"],
  publication: "Nature",
  year: "2025",
  doi: "10.1/x",
  abstract: "abstract",
  memo: "memo",
  notes: ["note"],
  tags: ["tag"],
  attachments: [{ id: 3, label: "paper.pdf", path: null }],
  attachmentID: 3,
  attachmentPath: null,
  lastRead: null,
};

describe("card interactions", () => {
  it("keeps imported short hex and named colors readable", () => {
    const { document } = new JSDOM().window;
    for (const color of ["#000", "#000f", "#000000ff", "navy"]) {
      const card = renderCard(
        paper,
        { ...defaultCardState(), colorOverride: color },
        { document },
      );
      assert.equal(card.dataset.tone, "dark", color);
      assert.equal(card.style.getPropertyValue("--card-ink"), "#ffffff");
    }
  });
  it("keeps text readable on an arbitrary mid-tone card color", () => {
    const { document } = new JSDOM().window;
    const card = renderCard(paper, defaultCardState(), {
      document,
      color: "#888888",
    });
    const channels = card.style
      .getPropertyValue("--card-ink")
      .slice(1)
      .match(/.{2}/g)!
      .map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
    const inkLuminance =
      channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    // #888888 has a hand-checked luminance of 0.2462; small card text needs 4.5:1.
    const contrast =
      (Math.max(0.2462, inkLuminance) + 0.05) /
      (Math.min(0.2462, inkLuminance) + 0.05);
    assert.ok(
      contrast >= 4.5,
      `Card text contrast is ${contrast.toFixed(2)}:1`,
    );
  });
  it("keeps button keyboard activation separate from opening details", () => {
    const { window } = new JSDOM();
    const actions: string[] = [];
    const card = renderCard(paper, defaultCardState(), {
      document: window.document,
      onAction: (action) => actions.push(action),
    });
    card
      .querySelector("button")!
      .dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    assert.deepEqual(actions, []);
    card.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    assert.deepEqual(actions, ["open-detail"]);
  });
  it("shows complete metadata, attachment unavailability and the change-cover action", () => {
    const { document } = new JSDOM().window;
    const card = renderCard(
      paper,
      { ...defaultCardState(), favorite: true },
      { document },
    );
    assert.match(card.textContent!, /A long paper title/);
    assert.match(card.textContent!, /Ada/);
    assert.match(card.textContent!, /Nature.*2025/);
    assert.match(card.textContent!, /未读/);
    assert.match(card.textContent!, /不可用/);
    assert.ok(card.querySelector('[aria-label="取消收藏"]'));
    assert.ok(card.querySelector('[data-action="change-cover"]'));
  });
});
