import { config } from "../package.json";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data = {
    alive: true,
    config,
    env: __env__ as "development" | "production",
    initialized: false,
    ztoolkit: createZToolkit(),
    locale: undefined as { current: any } | undefined,
  };

  public hooks = {
    onStartup: async () => {
      await Zotero.initializationPromise;
      this.data.initialized = true;
    },
    onShutdown: () => {
      this.data.alive = false;
      delete (Zotero as any)[config.addonInstance];
    },
    onMainWindowLoad: async (_win: Window) => {},
    onMainWindowUnload: async (_win: Window) => {},
  };

  public api = {};
}

export default Addon;
