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
  const detailWindows: JSDOM[] = [];
  (dom.window as any).openDialog = () => {
    const detail = new JSDOM(
      '<main id="zcl-detail-root"></main><div id="zcl-message"></div>',
      {
        url: "chrome://zcl/content/paper-detail.xhtml",
      },
    );
    Object.defineProperty(detail.window.document, "readyState", {
      value: "complete",
    });
    Object.assign(detail.window, {
      closed: false,
      focus() {},
      close() {
        detail.window.dispatchEvent(new detail.window.Event("unload"));
        (detail.window as any).closed = true;
      },
    });
    detailWindows.push(detail);
    return detail.window;
  };
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
  return { dom, state, controller, saved, added, detailWindows };
}
describe("card library controller", () => {
  it("renders the sidebar when initial navigation is empty", async () => {
    const { dom, controller, state } = setup({
      navigation: async () => ({ collections: [], tags: [] }),
    });
    state.viewState.scope = "library";
    try {
      await controller.start();
      assert.ok(dom.window.document.querySelector(".zcl-sidebar"));
    } finally {
      controller.destroy();
    }
  });
  it("refreshes one changed paper without rereading or replacing other cards", async () => {
    let title = "Original title";
    let listCalls = 0;
    let getCalls = 0;
    let navigationCalls = 0;
    const changed = () => ({ ...paper, title });
    const other = { ...paper, itemID: 2, title: "Other paper" };
    const { dom, controller, state } = setup({
      library: {
        list: async () => {
          listCalls++;
          return [changed(), other];
        },
        get: async () => {
          getCalls++;
          return changed();
        },
        openPDF: async () => {},
        addToCollection: async () => {},
      },
      navigation: async () => {
        navigationCalls++;
        return { collections: [], tags: [] };
      },
    });
    state.viewState.scope = "library";
    try {
      await controller.start();
      const unchanged =
        dom.window.document.querySelector<HTMLElement>('[data-item-id="2"]')!;
      unchanged.focus();
      title = "Updated title";
      await controller.refreshItems([1]);
      assert.equal(listCalls, 1);
      assert.equal(getCalls, 1);
      assert.equal(navigationCalls, 1);
      assert.equal(
        dom.window.document.querySelector('[data-item-id="2"]'),
        unchanged,
      );
      assert.equal(dom.window.document.activeElement, unchanged);
      assert.match(
        dom.window.document.querySelector('[data-item-id="1"]')!.textContent!,
        /Updated title/,
      );
    } finally {
      controller.destroy();
    }
  });
  it("keeps both papers when incremental refreshes overlap", async () => {
    const first = { ...paper, title: "First" };
    const second = { ...paper, itemID: 2, title: "Second" };
    let finishFirst!: (value: typeof paper) => void;
    let firstRead = true;
    const { dom, controller, state } = setup({
      library: {
        list: async () => [first, second],
        get: async (id) => {
          if (id === 1 && firstRead) {
            firstRead = false;
            return new Promise<typeof paper>((resolve) => {
              finishFirst = resolve;
            });
          }
          return id === 1
            ? { ...first, title: "Updated first" }
            : { ...second, title: "Updated second" };
        },
        openPDF: async () => {},
        addToCollection: async () => {},
      },
    });
    state.viewState.scope = "library";
    try {
      await controller.start();
      const firstRefresh = controller.refreshItems([1]);
      await controller.refreshItems([2]);
      finishFirst({ ...first, title: "Updated first" });
      await firstRefresh;
      assert.match(
        dom.window.document.querySelector('[data-item-id="1"]')!.textContent!,
        /Updated first/,
      );
      assert.match(
        dom.window.document.querySelector('[data-item-id="2"]')!.textContent!,
        /Updated second/,
      );
    } finally {
      controller.destroy();
    }
  });
  it("keeps unchanged cards and keyboard focus through a full refresh", async () => {
    const { dom, controller, state } = setup();
    state.viewState.scope = "library";
    try {
      await controller.start();
      const unchanged =
        dom.window.document.querySelector<HTMLElement>('[data-item-id="2"]')!;
      unchanged.focus();
      await controller.refresh();
      assert.equal(
        dom.window.document.querySelector('[data-item-id="2"]'),
        unchanged,
      );
      assert.equal(dom.window.document.activeElement, unchanged);
    } finally {
      controller.destroy();
    }
  });
  it("changes one card without replacing other cards or their focus", async () => {
    const { dom, controller, state } = setup();
    state.viewState.scope = "library";
    try {
      await controller.start();
      const other = dom.window.document.querySelector(
        '[data-item-id="2"]',
      ) as HTMLElement;
      other.focus();
      (
        dom.window.document.querySelector(
          '[data-item-id="1"] [data-action="toggle-favorite"]',
        ) as HTMLElement
      ).click();
      await tick();
      assert.equal(
        dom.window.document.querySelector('[data-item-id="2"]'),
        other,
      );
      assert.equal(dom.window.document.activeElement, other);
      assert.equal(state.items[1].favorite, true);
    } finally {
      controller.destroy();
    }
  });
  it("shows detail action failures inside the detail window", async () => {
    const { dom, controller, detailWindows } = setup({
      saveState: async () => {
        throw new Error("Save failed");
      },
      library: {
        list: async () => [paper],
        get: async () => paper,
        openPDF: async () => {
          throw new Error("PDF unavailable");
        },
        addToCollection: async () => {},
      } as any,
    });
    try {
      await controller.start();
      (dom.window.document.querySelector(".zcl-card") as HTMLElement).click();
      const dd = detailWindows[0].window.document;
      (dd.querySelector(".zcl-primary-button") as HTMLElement).click();
      await tick();
      assert.match(dd.getElementById("zcl-message")!.textContent!, /操作失败/);
      dd.getElementById("zcl-message")!.textContent = "";
      const status = dd.querySelector("select") as HTMLSelectElement;
      status.value = "read";
      status.dispatchEvent(new detailWindows[0].window.Event("change"));
      await tick();
      assert.match(dd.getElementById("zcl-message")!.textContent!, /操作失败/);
      assert.equal(
        dom.window.document.getElementById("zcl-message")!.textContent,
        "",
      );
    } finally {
      controller.destroy();
    }
  });
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
    const { dom, controller, state, detailWindows } = setup({
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
      const select = detailWindows[0].window.document.querySelector(
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
    const { dom, controller, added, detailWindows } = setup();
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
      detailWindows[0].window.document.querySelector(".zcl-detail-view")!
        .textContent!,
      /10.1\/x/,
    );
    assert.equal(d.querySelector(".zcl-detail-view"), null);
    assert.equal(
      d.getElementById("zcl-root")!.classList.contains("has-detail"),
      false,
    );
    controller.destroy();
  });
  it("reuses an independent detail window, switches papers, and cleans up on close", async () => {
    const { dom, controller, state, detailWindows } = setup();
    state.viewState.scope = "library";
    await controller.start();
    const cards =
      dom.window.document.querySelectorAll<HTMLElement>(".zcl-card");
    cards[0].click();
    cards[1].click();
    assert.equal(detailWindows.length, 1);
    const dd = detailWindows[0].window.document;
    assert.equal(
      dd.querySelector(".zcl-detail-title")?.textContent,
      cards[1].querySelector("h2")?.textContent,
    );
    assert.equal(dd.documentElement.dataset.theme, "dark");
    (dd.querySelector('[aria-label="关闭详情"]') as HTMLElement).click();
    assert.equal((detailWindows[0].window as any).closed, true);
    cards[0].click();
    assert.equal(detailWindows.length, 2);
    controller.destroy();
    assert.equal((detailWindows[1].window as any).closed, true);
  });
  it("shows the applied rule color in the detail color control", async () => {
    const { dom, controller, state, detailWindows } = setup();
    state.colorRules = [
      { source: "collection", value: "7", color: "navy", priority: 0 },
    ];
    await controller.start();
    (dom.window.document.querySelector(".zcl-card") as HTMLElement).click();
    assert.equal(
      (
        detailWindows[0].window.document.querySelector(
          'input[type="color"]',
        ) as HTMLInputElement
      ).value,
      "#000080",
    );
    controller.destroy();
  });
  it("updates the detail color control after changing reading status", async () => {
    const available = { ...paper, attachmentPath: "/paper.pdf" };
    const { dom, controller, detailWindows } = setup({
      library: {
        list: async () => [available],
        get: async () => available,
        openPDF: async () => {},
        addToCollection: async () => {},
      } as any,
    });
    try {
      await controller.start();
      (dom.window.document.querySelector(".zcl-card") as HTMLElement).click();
      const dd = detailWindows[0].window.document;
      const status = dd.querySelector("select") as HTMLSelectElement;
      status.value = "read";
      status.dispatchEvent(new detailWindows[0].window.Event("change"));
      await tick();
      assert.equal(
        (dd.querySelector('input[type="color"]') as HTMLInputElement).value,
        "#cce4dd",
      );
    } finally {
      controller.destroy();
    }
  });
});
