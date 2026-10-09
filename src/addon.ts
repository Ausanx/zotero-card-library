import { config } from "../package.json";
import { registerMenu } from "./bootstrap/menu";
import {
  loadState,
  saveState,
  defaultCardState,
  createDefaultState,
} from "./data/state-store";
import { createZoteroStateIO, getStatePath } from "./data/zotero-state-io";
import { exportStateFile, importStateFile } from "./data/backup-files";
import { AppController } from "./ui/app-controller";
import { WindowManager } from "./window/window-manager";
import { createLibraryAdapter } from "./zotero/library-adapter";
import { registerLibraryNotifier } from "./zotero/notifier";
import { createZoteroCoverService } from "./covers/zotero-pdf";
import type { CoverService } from "./covers/cover-service";
class Addon {
  public data = { alive: true, initialized: false, config };
  private state = createDefaultState();
  private readonly io = createZoteroStateIO();
  private controller?: AppController;
  private covers?: CoverService;
  private unregisterMenu?: () => void;
  private unregisterNotifier?: () => void;
  private readonly manager = new WindowManager((window) => this.mount(window));
  public api = {
    openCardLibrary: (window?: Window) =>
      this.manager.open(window, this.state.windowState),
  };
  public async startup(): Promise<void> {
    await Zotero.initializationPromise;
    this.state = await loadState(this.io, getStatePath());
    this.unregisterMenu = registerMenu(() => this.api.openCardLibrary());
    this.unregisterNotifier = registerLibraryNotifier(
      Zotero.Notifier as any,
      () => {
        void this.controller
          ?.refresh()
          .catch((error) => Zotero.logError(error));
      },
      100,
      (ids) => {
        let changed = false;
        for (const id of ids) {
          const attachment = Zotero.Items.get(Number(id));
          if (!attachment?.isPDFAttachment() || !attachment.parentID) continue;
          const state = (this.state.items[attachment.parentID] ||=
            defaultCardState());
          if (state.readingStatus === "unread") {
            state.readingStatus = "reading";
            state.updatedAt = Date.now();
            changed = true;
          }
        }
        if (changed)
          void this.persist().catch((error) => Zotero.logError(error));
      },
    );
    this.data.initialized = true;
  }
  public async shutdown(): Promise<void> {
    this.data.alive = false;
    this.unregisterMenu?.();
    this.unregisterNotifier?.();
    this.manager.close();
    this.controller?.destroy();
    this.covers?.dispose();
    await this.persist();
  }
  private persist(): Promise<void> {
    return saveState(this.io, getStatePath(), this.state);
  }
  private async mount(window: Window): Promise<void> {
    if (!this.data.alive || window.closed) return;
    const geometry = this.state.windowState;
    if (geometry.x !== undefined && geometry.y !== undefined) {
      const screen = window.screen;
      window.moveTo(
        Math.max(
          screen.availLeft,
          Math.min(screen.availLeft + screen.availWidth - 200, geometry.x),
        ),
        Math.max(
          screen.availTop,
          Math.min(screen.availTop + screen.availHeight - 100, geometry.y),
        ),
      );
    }
    this.covers = createZoteroCoverService(window);
    const getMemoField = () => this.state.fieldMapping.memoField;
    const library = createLibraryAdapter(Zotero as any, {
      get memoField() {
        return getMemoField();
      },
    });
    const controller = new AppController({
      document: window.document,
      library,
      state: this.state,
      saveState: (state) => saveState(this.io, getStatePath(), state),
      covers: this.covers,
      navigation: async () => {
        const libraryID = Zotero.Libraries.userLibraryID;
        const collections = Zotero.Collections.getByLibrary(
          libraryID,
          true,
        ).map((collection) => ({ id: collection.id, name: collection.name }));
        const items = await Zotero.Items.getAll(libraryID);
        const tags = [
          ...new Set(
            items
              .filter((item) => item.isRegularItem() && !item.deleted)
              .flatMap((item) => item.getTags().map((tag) => tag.tag)),
          ),
        ].sort();
        const selected = (
          Zotero.getMainWindow() as any
        )?.ZoteroPane?.getSelectedCollection();
        return {
          collections,
          tags,
          currentCollectionID:
            selected?.libraryID === libraryID ? selected.id : null,
        };
      },
      exportBackup: () => exportStateFile(window, this.state),
      importBackup: () => importStateFile(window),
    });
    this.controller = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saveGeometry = () => {
      Object.assign(this.state.windowState, {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
      });
      void this.persist().catch((error) => Zotero.logError(error));
    };
    const resize = () => {
      clearTimeout(timer);
      timer = setTimeout(saveGeometry, 200);
    };
    window.addEventListener("resize", resize);
    window.addEventListener(
      "unload",
      () => {
        clearTimeout(timer);
        saveGeometry();
        controller.destroy();
        this.covers?.dispose();
        window.removeEventListener("resize", resize);
        if (this.controller === controller) this.controller = undefined;
      },
      { once: true },
    );
    await controller.start();
  }
}
export default Addon;
