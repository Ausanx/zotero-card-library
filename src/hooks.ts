async function onStartup() {
  await Zotero.initializationPromise;
  addon.data.initialized = true;
}

function onShutdown() {
  addon.data.alive = false;
  delete (Zotero as any)[addon.data.config.addonInstance];
}

async function onMainWindowLoad(_win: Window) {}

async function onMainWindowUnload(_win: Window) {}

export default { onStartup, onShutdown, onMainWindowLoad, onMainWindowUnload };
