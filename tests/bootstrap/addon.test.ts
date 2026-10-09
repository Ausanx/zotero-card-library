import assert from "node:assert/strict";
import { it } from "mocha";
import { posix } from "node:path";
import Addon from "../../src/addon";

it("preserves unsupported future state when a failed startup is shut down", async () => {
  const globals = globalThis as any;
  const previous = {
    Zotero: globals.Zotero,
    PathUtils: globals.PathUtils,
    IOUtils: globals.IOUtils,
  };
  const future = JSON.stringify({
    schemaVersion: 99,
    items: { retained: "future data" },
  });
  const files = new Map([["/profile/zotero-card-library/state.json", future]]);
  globals.Zotero = {
    initializationPromise: Promise.resolve(),
    getProfileDirectory: () => ({ path: "/profile" }),
  };
  globals.PathUtils = { join: posix.join, parent: posix.dirname };
  globals.IOUtils = {
    readUTF8: async (path: string) => files.get(path),
    makeDirectory: async () => {},
    writeUTF8: async (path: string, value: string) => {
      files.set(path, value);
    },
    move: async (source: string, target: string) => {
      files.set(target, files.get(source)!);
      files.delete(source);
    },
  };
  try {
    const addon = new Addon();
    await assert.rejects(addon.startup(), /Unsupported/);
    await addon.shutdown();
    assert.equal(files.get("/profile/zotero-card-library/state.json"), future);
  } finally {
    Object.assign(globals, previous);
  }
});
