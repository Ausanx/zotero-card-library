import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import { AppController } from "../../src/ui/app-controller";
import { createDefaultState } from "../../src/data/state-store";
import { paper } from "../fixtures/paper";
const tick = () => new Promise((resolve) => setTimeout(resolve, 200));
function setup() {
  const dom = new JSDOM(
    '<div id="zcl-root"><aside id="zcl-sidebar"></aside><main id="zcl-main"><select id="zcl-sort"><option value="title">Title</option></select><span id="zcl-result-count"></span><div id="zcl-batch"></div><div id="zcl-message"></div><section id="zcl-board"></section></main></div>',
  );
  const state = createDefaultState();
  state.viewState.scope = "collection:7";
  state.viewState.theme = "dark";
  const saved: string[] = [];
  const added: number[][] = [];
  const controller = new AppController({
    document: dom.window.document,
    state,
    library: {
      list: async () => [
        paper,
        { ...paper, itemID: 2, title: "Another", collectionIDs: [] },
      ],
      get: async () => paper,
      openPDF: async () => {},
      addToCollection: async (ids) => {
        added.push(ids);
      },
    },
    saveState: async (s) => {
      saved.push(JSON.stringify(s));
    },
    navigation: async () => ({
      collections: [{ id: 7, name: "Research" }],
      tags: ["tag"],
      currentCollectionID: 7,
    }),
  } as any);
  return { dom, state, controller, saved, added };
}
describe("card library controller", () => {
  it("restores scope/theme and persists search and favorite interactions", async () => {
    const { dom, state, controller, saved } = setup();
    await controller.start();
    const d = dom.window.document;
    assert.equal(d.querySelectorAll(".zcl-card").length, 1);
    assert.equal(d.getElementById("zcl-root")!.dataset.theme, "dark");
    (d.querySelector('[data-action="toggle-favorite"]') as HTMLElement).click();
    await tick();
    assert.equal(state.items[1].favorite, true);
    const search = d.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = "missing";
    search.dispatchEvent(new dom.window.Event("input"));
    await tick();
    assert.equal(d.querySelectorAll(".zcl-card").length, 0);
    assert.match(saved[saved.length - 1], /missing/);
    controller.destroy();
  });
  it("requires an explicit destination for selected items and shows DOI in details", async () => {
    const { dom, controller, added } = setup();
    await controller.start();
    const d = dom.window.document;
    (
      d.querySelector('.zcl-card input[type="checkbox"]') as HTMLInputElement
    ).click();
    const apply = d.querySelector(
      '#zcl-batch button[data-action="add-to-collection"]',
    ) as HTMLButtonElement;
    assert.ok(apply.disabled);
    const destination = d.querySelector(
      "#zcl-batch select",
    ) as HTMLSelectElement;
    destination.value = "7";
    destination.dispatchEvent(new dom.window.Event("change"));
    apply.click();
    await tick();
    assert.deepEqual(added, [[1]]);
    (d.querySelector(".zcl-card") as HTMLElement).click();
    assert.match(
      d.querySelector(".zcl-detail-drawer")!.textContent!,
      /10.1\/x/,
    );
    assert.ok(d.getElementById("zcl-root")!.classList.contains("has-detail"));
    controller.destroy();
  });
});
