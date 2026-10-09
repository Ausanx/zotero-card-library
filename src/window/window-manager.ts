import { config } from "../../package.json";
import type { PluginState } from "../domain/types";
export type CardWindowMount = (window: Window) => Promise<void> | void;
export class WindowManager {
  private cardWindow: Window | null = null;
  constructor(private readonly mount: CardWindowMount) {}
  open(
    hostWindow?: Window,
    geometry: PluginState["windowState"] = {
      width: 1440,
      height: 900,
      detailWidth: 420,
    },
  ): Window | null {
    if (this.window) {
      this.cardWindow!.focus();
      return this.cardWindow;
    }
    const host = hostWindow || Zotero.getMainWindow();
    const opened = (host as any).openDialog(
      `chrome://${config.addonRef}/content/card-library.xhtml`,
      "zcl-card-library",
      `chrome,dialog=no,resizable,centerscreen,width=${Math.max(800, geometry.width)},height=${Math.max(600, geometry.height)}`,
    ) as Window | null;
    if (!opened) return null;
    this.cardWindow = opened;
    const mount = () => {
      if (this.cardWindow !== opened) return;
      opened.addEventListener(
        "unload",
        () => {
          if (this.cardWindow === opened) this.cardWindow = null;
        },
        { once: true },
      );
      void Promise.resolve(this.mount(opened)).catch((error) => {
        const message = opened.document.getElementById("zcl-message");
        if (message)
          message.textContent = "卡片库加载失败，请查看 Zotero 错误控制台。";
        Zotero.logError(error);
      });
    };
    if (
      opened.document?.readyState === "complete" &&
      opened.document.URL !== "about:blank"
    )
      mount();
    else opened.addEventListener("load", mount, { once: true });
    return opened;
  }
  close(): void {
    this.window?.close();
    this.cardWindow = null;
  }
  get window(): Window | null {
    try {
      return this.cardWindow && !this.cardWindow.closed
        ? this.cardWindow
        : null;
    } catch {
      return null;
    }
  }
}
