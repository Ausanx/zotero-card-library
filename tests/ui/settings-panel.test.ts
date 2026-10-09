import assert from "node:assert/strict";
import { it } from "mocha";
import { JSDOM } from "jsdom";
import { openSettings } from "../../src/ui/settings-panel";
import {
  createDefaultState,
  defaultCardState,
} from "../../src/data/state-store";

it("preserves card and window changes made while settings remain open", async () => {
  const dom = new JSDOM("<body></body>");
  Object.assign(dom.window.HTMLDialogElement.prototype, {
    showModal() {},
    close() {},
  });
  const state = createDefaultState();
  state.items[1] = defaultCardState();
  let saved: typeof state | undefined;
  openSettings(
    dom.window.document,
    state,
    { collections: [], tags: [] },
    {
      save: async (value) => {
        saved = value;
      },
    },
  );
  state.items[1].readingStatus = "reading";
  state.items[1].updatedAt = 123;
  state.windowState.width = 1200;
  const select = dom.window.document.querySelector(
    "select",
  ) as HTMLSelectElement;
  select.value = "dark";
  (
    [...dom.window.document.querySelectorAll("button")].find(
      (button) => button.textContent === "保存设置",
    ) as HTMLElement
  ).click();
  await Promise.resolve();
  assert.equal(saved?.items[1].readingStatus, "reading");
  assert.equal(saved?.items[1].updatedAt, 123);
  assert.equal(saved?.windowState.width, 1200);
  assert.equal(saved?.viewState.theme, "dark");
});
