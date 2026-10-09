import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import {
  AppController,
  type AppControllerOptions,
} from "../../src/ui/app-controller";
import {
  createDefaultState,
  defaultCardState,
} from "../../src/data/state-store";
import { paper } from "../fixtures/paper";
const tick = () => new Promise((resolve) => setTimeout(resolve, 200));
function setup(overrides: Partial<AppControllerOptions> = {}) {
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
    ...overrides,
  } as any);
  return { dom, state, controller, saved, added };
}
describe("card library controller", () => {
  it("preserves reader changes arriving while a settings save is pending", async () => {
    let finishSave!: () => void;
    const { dom, controller, state } = setup({
      saveState: () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    });
    Object.assign(dom.window.HTMLDialogElement.prototype, {
      showModal() {},
      close() {},
    });
    state.items[1] = defaultCardState();
    try {
      await controller.start();
      (
        [
          ...dom.window.document.querySelectorAll(".zcl-sidebar-footer button"),
        ].find((button) => button.textContent === "外观与设置") as HTMLElement
      ).click();
      (
        [...dom.window.document.querySelectorAll("dialog button")].find(
          (button) => button.textContent === "保存设置",
        ) as HTMLElement
      ).click();
      state.items[1].readingStatus = "reading";
      finishSave();
      await tick();
      assert.equal(state.items[1].readingStatus, "reading");
    } finally {
      controller.destroy();
    }
  });
  it("renders the newly selected attachment after an older cover request finishes", async () => {
    let finishOld!: (value: any) => void;
    const calls: number[] = [];
    const result = (id: number) => ({
      url: `data:image/png;base64,${id === 4 ? "bmV3" : "b2xk"}`,
      reference: {
        attachmentID: id,
        source: "first-page",
        page: 1,
        bbox: [0, 0, 1, 1],
        cacheKey: String(id),
      },
    });
    const available = {
      ...paper,
      attachmentPath: "/old.pdf",
      attachments: [
        { id: 3, label: "Old PDF", path: "/old.pdf" },
        { id: 4, label: "New PDF", path: "/new.pdf" },
      ],
    };
    const { dom, controller, state } = setup({
      library: {
        list: async () => [available],
        get: async () => available,
        openPDF: async () => {},
        addToCollection: async () => {},
      },
      covers: {
        getCover: (id: number) => {
          calls.push(id);
          return id === 3
            ? new Promise((resolve) => {
                finishOld = resolve;
              })
            : Promise.resolve(result(id));
        },
        getCandidates: async () => [],
      } as any,
    });
    try {
      await controller.start();
      (dom.window.document.querySelector(".zcl-card") as HTMLElement).click();
      const select = dom.window.document.querySelector(
        'select[aria-label="封面与阅读的来源附件"]',
      ) as HTMLSelectElement;
      select.value = "4";
      select.dispatchEvent(new dom.window.Event("change"));
      await tick();
      finishOld(result(3));
      await tick();
      assert.deepEqual(calls, [3, 4]);
      assert.equal(state.items[1].cover?.attachmentID, 4);
      assert.equal(
        (
          dom.window.document.querySelector(
            ".zcl-card-cover img",
          ) as HTMLImageElement
        )?.src,
        result(4).url,
      );
    } finally {
      controller.destroy();
    }
  });
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
