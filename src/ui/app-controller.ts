import type { PaperDTO } from "../domain/metadata";
import { searchPapers, sortPapers } from "../domain/search";
import type { CardState, PluginState } from "../domain/types";
import { defaultCardState, importBackup } from "../data/state-store";
import type { LibraryAdapter } from "../zotero/library-adapter";
import type { CoverService, CoverResult } from "../covers/cover-service";
import { renderBoard } from "./card-board";
import { resolveCardColor } from "./card-view";
import { resolveColor } from "../domain/color-rules";
import { createDetailView } from "./detail-view";
import { WindowManager } from "../window/window-manager";
import { renderSidebar, type NavigationData } from "./sidebar";
import { openCropEditor } from "./crop-editor";
import { openSettings } from "./settings-panel";
import { element, button, option } from "./dom";
export type AppControllerOptions = {
  document: Document;
  library: LibraryAdapter;
  state: PluginState;
  saveState(state: PluginState): Promise<void>;
  covers?: CoverService;
  navigation?: () => Promise<NavigationData>;
  exportBackup?: () => Promise<void>;
  importBackup?: () => Promise<PluginState | null>;
};
export class AppController {
  private readonly root: HTMLElement;
  private readonly board: HTMLElement;
  private readonly main: HTMLElement;
  private readonly detailManager: WindowManager;
  private detailView?: ReturnType<typeof createDetailView>;
  private items: PaperDTO[] = [];
  private navigation: NavigationData = { collections: [], tags: [] };
  private selection = new Set<number>();
  private coverURLs = new Map<number, string>();
  private pendingCovers = new Set<number>();
  private observer?: IntersectionObserver;
  private queryTimer?: ReturnType<typeof setTimeout>;
  private scrollTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private generation = 0;
  private detailID: number | null = null;
  private readonly cleanups: (() => void)[] = [];
  constructor(private readonly options: AppControllerOptions) {
    const d = options.document;
    this.root = d.getElementById("zcl-root") as HTMLElement;
    this.board = d.getElementById("zcl-board") as HTMLElement;
    this.main = d.getElementById("zcl-main") as HTMLElement;
    if (!this.root || !this.board || !this.main)
      throw new Error("Card library root is missing");
    this.detailManager = new WindowManager(
      (window) => this.mountDetail(window),
      {
        page: "paper-detail.xhtml",
        name: "zcl-paper-detail",
        minWidth: 600,
      },
    );
  }
  get detailWindow(): Window | null {
    return this.detailManager.window;
  }
  private mountDetail(window: Window): void {
    if (this.disposed || window.closed) return;
    const d = window.document;
    const options = this.options;
    const view = createDetailView({
      document: d,
      onClose: () => this.detailManager.close(),
      onOpenPDF: (item) => this.run(() => this.openPDF(item), d),
      onState: (item, patch) =>
        this.run(async () => {
          await this.updateCard(item, patch);
          this.refreshDetail();
        }, d),
      onAttachment: (item, id) =>
        this.run(async () => {
          await this.updateCard(item, {
            selectedAttachmentID: id,
            cover: null,
          });
          this.coverURLs.delete(item.itemID);
          this.render();
          this.refreshDetail();
        }, d),
      candidates: options.covers
        ? (item) => options.covers!.getCandidates(item.attachmentID!)
        : undefined,
      onCandidate: (item, candidate) =>
        this.run(
          async () =>
            this.applyCover(
              item,
              await options.covers!.choose(
                candidate.attachmentID,
                candidate.page,
                candidate.bbox,
                "candidate",
              ),
            ),
          d,
        ),
      onManualCrop: (item) => {
        if (options.covers && item.attachmentID)
          openCropEditor(d, options.covers, item.attachmentID, (cover) =>
            this.applyCover(item, cover),
          );
      },
    });
    this.detailView = view;
    d.getElementById("zcl-detail-root")!.append(view.element);
    window.addEventListener(
      "unload",
      () => {
        view.destroy();
        d.querySelectorAll("dialog").forEach((dialog: Element) =>
          dialog.remove(),
        );
        if (this.detailView === view) {
          this.detailView = undefined;
          this.detailID = null;
        }
      },
      { once: true },
    );
    this.refreshDetail();
  }
  async start(): Promise<void> {
    const sort = this.options.document.getElementById(
      "zcl-sort",
    ) as HTMLSelectElement | null;
    if (sort) {
      sort.value = this.options.state.viewState.sort;
      this.listen(sort, "change", () => {
        this.options.state.viewState.sort = sort.value;
        this.render();
        this.run(() => this.persist());
      });
    }
    this.listen(this.main, "scroll", () => {
      this.options.state.viewState.scrollTop = this.main.scrollTop;
      clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => this.run(() => this.persist()), 200);
    });
    const refresh = this.options.document.getElementById("zcl-refresh");
    if (refresh)
      this.listen(refresh, "click", () => this.run(() => this.refresh()));
    await this.refresh();
    this.main.scrollTop = this.options.state.viewState.scrollTop;
  }
  async refresh(): Promise<void> {
    const generation = ++this.generation;
    const [items, navigation] = await Promise.all([
      this.options.library.list({ kind: "library" }),
      this.options.navigation?.(),
    ]);
    if (this.disposed || generation !== this.generation) return;
    this.items = items;
    this.navigation = navigation || {
      collections: [],
      tags: [...new Set(items.flatMap((i) => i.tags))],
    };
    if (this.options.state.viewState.scope === "current")
      this.options.state.viewState.scope = this.navigation.currentCollectionID
        ? `collection:${this.navigation.currentCollectionID}`
        : "library";
    this.selection = new Set(
      [...this.selection].filter((id) => items.some((i) => i.itemID === id)),
    );
    this.coverURLs.clear();
    this.renderSidebar();
    this.render();
    this.refreshDetail();
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    clearTimeout(this.queryTimer);
    clearTimeout(this.scrollTimer);
    this.observer?.disconnect();
    this.detailManager.close();
    this.detailView?.destroy();
    this.options.document
      .querySelectorAll("dialog")
      .forEach((dialog: Element) => dialog.remove());
    this.cleanups.forEach((fn) => fn());
  }
  private listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
  ): void {
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }
  private run(
    action: () => Promise<unknown>,
    document = this.options.document,
  ): void {
    void action().catch(() =>
      this.message("操作失败，请检查本地文件和保存权限后重试。", document),
    );
  }
  private message(text: string, document = this.options.document): void {
    const node = document.getElementById("zcl-message");
    if (node) node.textContent = text;
  }
  private renderSidebar(): void {
    const state = this.options.state;
    this.root.dataset.theme = state.viewState.theme;
    this.options.document.documentElement!.setAttribute(
      "data-theme",
      state.viewState.theme,
    );
    if (this.detailWindow)
      this.detailWindow.document.documentElement!.setAttribute(
        "data-theme",
        state.viewState.theme,
      );
    const sidebar = renderSidebar({
      document: this.options.document,
      navigation: this.navigation,
      scope: state.viewState.scope,
      query: state.viewState.query,
      theme: state.viewState.theme,
      onScope: (scope) => {
        state.viewState.scope =
          scope.kind === "library"
            ? "library"
            : scope.kind === "tag"
              ? `tag:${scope.tag}`
              : `collection:${scope.collectionID}`;
        this.selection.clear();
        this.renderSidebar();
        this.render();
        this.main.scrollTop = 0;
        this.run(() => this.persist());
      },
      onQuery: (query) => {
        state.viewState.query = query;
        clearTimeout(this.queryTimer);
        this.queryTimer = setTimeout(() => {
          if (!this.disposed) {
            this.render();
            this.run(() => this.persist());
          }
        }, 120);
      },
      onTheme: (theme) => {
        state.viewState.theme = theme;
        this.renderSidebar();
        this.run(() => this.persist());
      },
      onSettings: () =>
        openSettings(this.options.document, state, this.navigation, {
          save: (next, settingsOnly) => this.replaceState(next, settingsOnly),
          export: this.options.exportBackup,
          import: this.options.importBackup,
        }),
    });
    this.options.document
      .getElementById("zcl-sidebar")
      ?.replaceChildren(sidebar);
  }
  private displayed(item: PaperDTO): PaperDTO {
    const selected =
      this.options.state.items[item.itemID]?.selectedAttachmentID;
    const attachment = selected
      ? item.attachments.find((a) => a.id === selected)
      : undefined;
    return attachment
      ? {
          ...item,
          attachmentID: attachment.id,
          attachmentPath: attachment.path,
        }
      : item;
  }
  private render(): void {
    if (this.disposed) return;
    const view = this.options.state.viewState;
    let items = this.items;
    if (view.scope.startsWith("collection:"))
      items = items.filter((i) =>
        i.collectionIDs?.includes(Number(view.scope.slice(11))),
      );
    if (view.scope.startsWith("tag:"))
      items = items.filter((i) => i.tags.includes(view.scope.slice(4)));
    const visible = sortPapers(searchPapers(items, view.query), view.sort).map(
      (item) => this.displayed(item),
    );
    renderBoard(this.board, visible, this.options.state.items, {
      document: this.options.document,
      covers: this.coverURLs,
      selection: this.selection,
      colorRules: this.options.state.colorRules,
      onAction: (action, item) => {
        if (action === "open-detail" || action === "change-cover")
          this.showDetail(item.itemID);
        else if (action === "toggle-favorite")
          this.run(() =>
            this.updateCard(item, {
              favorite: !this.cardState(item.itemID).favorite,
            }),
          );
        else if (action === "open-pdf") this.run(() => this.openPDF(item));
      },
      onSelect: (item, selected) => {
        if (selected) this.selection.add(item.itemID);
        else this.selection.delete(item.itemID);
        this.renderBatch();
      },
    });
    if (!visible.length)
      this.board.append(
        element(
          this.options.document,
          "p",
          "zcl-empty",
          "没有匹配的文献。试试其他关键词或切换合集。",
        ),
      );
    const count = this.options.document.getElementById("zcl-result-count");
    if (count) count.textContent = `${visible.length} 篇文献`;
    this.renderBatch();
    this.observeCovers(visible);
  }
  private observeCovers(items: PaperDTO[]): void {
    this.observer?.disconnect();
    const Observer = this.options.document.defaultView?.IntersectionObserver;
    if (!this.options.covers) return;
    if (Observer) {
      this.observer = new Observer(
        (entries: IntersectionObserverEntry[]) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              const item = items.find(
                (i) =>
                  String(i.itemID) ===
                  (entry.target as HTMLElement).dataset.itemId,
              );
              if (item) this.ensureCover(item);
              this.observer?.unobserve(entry.target);
            }
        },
        { root: this.main, rootMargin: "200px" },
      );
      this.board
        .querySelectorAll(".zcl-card")
        .forEach((card: Element) => this.observer!.observe(card));
    } else items.forEach((item) => this.ensureCover(item));
  }
  private ensureCover(item: PaperDTO): void {
    if (
      !item.attachmentID ||
      !item.attachmentPath ||
      this.coverURLs.has(item.itemID) ||
      this.pendingCovers.has(item.itemID)
    )
      return;
    this.pendingCovers.add(item.itemID);
    const reference = this.cardState(item.itemID).cover;
    void this.options
      .covers!.getCover(item.attachmentID, reference)
      .then(async (cover) => {
        if (this.disposed) return;
        const current = this.items.find((i) => i.itemID === item.itemID);
        if (
          !current ||
          this.displayed(current).attachmentID !== item.attachmentID ||
          this.cardState(item.itemID).cover !== reference
        )
          return;
        this.coverURLs.set(item.itemID, cover.url);
        this.cardState(item.itemID).cover = cover.reference;
        const target = this.board.querySelector<HTMLElement>(
          `[data-item-id="${item.itemID}"] .zcl-card-cover`,
        );
        if (target) {
          const image = element(this.options.document, "img");
          image.src = cover.url;
          image.alt = `${item.title} 文献图片`;
          target.replaceChildren(image);
          target.classList.remove("is-placeholder");
        }
        await this.persist();
      })
      .catch(() => {
        if (!this.disposed) {
          const target = this.board.querySelector(
            `[data-item-id="${item.itemID}"] .zcl-card-cover`,
          );
          if (target) target.textContent = "封面生成失败，可在详情中重试";
        }
      })
      .finally(() => {
        this.pendingCovers.delete(item.itemID);
        const current = this.items.find((i) => i.itemID === item.itemID);
        if (
          !this.disposed &&
          current &&
          !this.coverURLs.has(item.itemID) &&
          (this.displayed(current).attachmentID !== item.attachmentID ||
            this.cardState(item.itemID).cover !== reference) &&
          this.board.querySelector(`[data-item-id="${item.itemID}"]`)
        ) {
          this.ensureCover(this.displayed(current));
        }
      });
  }
  private renderBatch(): void {
    const d = this.options.document;
    const bar = d.getElementById("zcl-batch") as HTMLElement | null;
    if (!bar) return;
    bar.replaceChildren();
    bar.hidden = !this.selection.size;
    if (!this.selection.size) return;
    const select = element(d, "select");
    select.setAttribute("aria-label", "加入目标合集");
    select.append(option(d, "", "选择目标合集"));
    for (const c of this.navigation.collections)
      select.append(option(d, String(c.id), c.name));
    const apply = button(
      d,
      "加入合集",
      () =>
        this.run(async () => {
          apply.disabled = true;
          try {
            await this.options.library.addToCollection(
              [...this.selection],
              Number(select.value),
            );
            this.selection.clear();
            await this.refresh();
            this.message("已加入所选合集。");
          } finally {
            apply.disabled = !select.value;
          }
        }),
      "zcl-primary-button",
    );
    apply.dataset.action = "add-to-collection";
    apply.disabled = true;
    select.addEventListener("change", () => (apply.disabled = !select.value));
    bar.append(
      element(d, "span", "", `已选择 ${this.selection.size} 篇`),
      select,
      apply,
      button(d, "取消选择", () => {
        this.selection.clear();
        this.render();
      }),
    );
  }
  private showDetail(id: number): void {
    if (this.disposed || !this.items.some((item) => item.itemID === id)) return;
    this.detailID = id;
    const existing = this.detailManager.window;
    const window = this.detailManager.open(
      this.options.document.defaultView || undefined,
      {
        width: 960,
        height: 820,
        detailWidth: this.options.state.windowState.detailWidth,
      },
    );
    if (!window) {
      this.detailID = null;
      this.message("无法打开详情窗口，请重试。");
    } else if (existing) this.refreshDetail();
  }
  private refreshDetail(): void {
    if (!this.detailView || !this.detailID || this.disposed) return;
    const item = this.items.find((i) => i.itemID === this.detailID);
    if (!item) {
      this.detailManager.close();
      return;
    }
    const d = this.detailWindow!.document;
    d.documentElement!.setAttribute(
      "data-theme",
      this.options.state.viewState.theme,
    );
    d.title = `${item.title} — 文献详情`;
    const displayed = this.displayed(item);
    const state = this.cardState(item.itemID);
    this.detailView.show(
      displayed,
      state,
      resolveCardColor(
        displayed,
        state,
        resolveColor(displayed, state, this.options.state.colorRules),
      ),
    );
  }
  private async updateCard(
    item: PaperDTO,
    patch: Partial<CardState>,
  ): Promise<void> {
    Object.assign(this.cardState(item.itemID), patch, {
      updatedAt: Date.now(),
    });
    await this.persist();
    this.render();
  }
  private async applyCover(item: PaperDTO, cover: CoverResult): Promise<void> {
    const current = this.items.find((i) => i.itemID === item.itemID);
    if (
      !current ||
      this.displayed(current).attachmentID !== cover.reference.attachmentID
    )
      return;
    this.coverURLs.set(item.itemID, cover.url);
    await this.updateCard(item, { cover: cover.reference });
  }
  private async openPDF(item: PaperDTO): Promise<void> {
    if (!item.attachmentID) return;
    await this.options.library.openPDF(item.itemID, item.attachmentID);
    const state = this.cardState(item.itemID);
    if (state.readingStatus === "unread") state.readingStatus = "reading";
    state.updatedAt = Date.now();
    await this.persist();
    this.render();
    if (this.detailID === item.itemID) this.refreshDetail();
  }
  private cardState(id: number): CardState {
    return (this.options.state.items[id] ||= defaultCardState());
  }
  private persist(): Promise<void> {
    return this.options.saveState(this.options.state);
  }
  private async replaceState(
    next: PluginState,
    settingsOnly = false,
  ): Promise<void> {
    const valid = importBackup(next);
    if (settingsOnly) {
      this.options.state.viewState.theme = valid.viewState.theme;
      this.options.state.fieldMapping = valid.fieldMapping;
      this.options.state.colorRules = valid.colorRules;
      await this.persist();
      await this.refresh();
      return;
    }
    await this.options.saveState(valid);
    Object.assign(this.options.state, valid);
    this.selection.clear();
    const sort = this.options.document.getElementById(
      "zcl-sort",
    ) as HTMLSelectElement | null;
    if (sort) sort.value = valid.viewState.sort;
    await this.refresh();
    this.main.scrollTop = valid.viewState.scrollTop;
  }
}
export async function mountCardLibraryWindow(
  document: Document,
  library: LibraryAdapter,
  state: PluginState,
  saveState: (state: PluginState) => Promise<void>,
): Promise<AppController> {
  const controller = new AppController({ document, library, state, saveState });
  await controller.start();
  return controller;
}
