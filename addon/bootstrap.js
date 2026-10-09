// Zotero bootstrapped add-on entry points. Runtime code is bundled from src/index.ts.
var chromeRegistration;
var context;
async function startup(data) {
  const root = data.rootURI || data.resourceURI.spec;
  const startupService = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  chromeRegistration = startupService.registerChrome(
    Services.io.newURI(root + "manifest.json"),
    [["content", "zcl", root + "content/"]],
  );
  const timers = ChromeUtils.importESModule(
    "resource://gre/modules/Timer.sys.mjs",
  );
  context = {
    Zotero,
    Services,
    Components,
    ChromeUtils,
    IOUtils,
    PathUtils,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  };
  context._globalThis = context;
  Services.scriptloader.loadSubScript(root + "content/scripts/zcl.js", context);
  Zotero.ZoteroCardLibrary = context.zcl;
  await context.zcl.startup();
}
async function shutdown() {
  try {
    await context?.zcl?.shutdown();
  } finally {
    delete Zotero.ZoteroCardLibrary;
    chromeRegistration?.destruct();
    chromeRegistration = null;
    context = null;
  }
}
function install() {}
function uninstall() {}
function onMainWindowLoad() {}
function onMainWindowUnload() {}
