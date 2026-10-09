import assert from "node:assert/strict";
import { it } from "mocha";
import { WindowManager } from "../../src/window/window-manager";
it("opens one window with the host binding and restores requested geometry", () => {
  let focused = 0,
    features = "";
  const window = {
    closed: false,
    focus: () => focused++,
    addEventListener: () => {},
    close: () => {
      window.closed = true;
    },
  };
  const host = {
    openDialog: function (_url: string, _name: string, value: string) {
      assert.equal(this, host);
      features = value;
      return window;
    },
  };
  const manager = new WindowManager(() => {});
  manager.open(host as any, { width: 1200, height: 800, detailWidth: 400 });
  manager.open(host as any, { width: 1200, height: 800, detailWidth: 400 });
  assert.match(features, /width=1200/);
  assert.equal(focused, 1);
  manager.close();
  assert.equal(window.closed, true);
});

it("mounts a chrome dialog that finished loading before openDialog returned", () => {
  let mounted = 0;
  const opened = {
    closed: false,
    document: { readyState: "complete" },
    addEventListener: () => {},
  };
  const host = { openDialog: () => opened };
  new WindowManager(() => {
    mounted++;
  }).open(host as any);
  assert.equal(mounted, 1);
});

it("keeps the window while its initial about:blank document unloads", () => {
  const listeners = new Map<string, () => void>();
  let mounted = 0;
  const opened = {
    closed: false,
    document: { readyState: "loading", URL: "about:blank" },
    addEventListener: (type: string, listener: () => void) =>
      listeners.set(type, listener),
  };
  const manager = new WindowManager(() => {
    mounted++;
  });
  manager.open({ openDialog: () => opened } as any);
  listeners.get("unload")?.();
  opened.document = {
    readyState: "complete",
    URL: "chrome://zcl/content/card-library.xhtml",
  };
  listeners.get("load")?.();
  assert.equal(mounted, 1);
  assert.equal(manager.window, opened);
});
