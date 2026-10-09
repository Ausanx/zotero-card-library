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
