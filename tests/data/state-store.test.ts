import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  createDefaultState,
  loadState,
  saveState,
  exportBackup,
  importBackup,
  type StateIO,
} from "../../src/data/state-store";

class MemoryIO implements StateIO {
  files = new Map<string, string>();

  async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error("ENOENT");
    return value;
  }

  async write(path: string, contents: string): Promise<void> {
    this.files.set(path, contents);
  }

  async replace(tempPath: string, targetPath: string): Promise<void> {
    const contents = this.files.get(tempPath);
    if (contents === undefined) throw new Error("missing temp file");
    this.files.set(targetPath, contents);
    this.files.delete(tempPath);
  }
}

describe("state store", () => {
  it("serializes overlapping writes and snapshots state at the call boundary", async () => {
    const io = new MemoryIO();
    const state = createDefaultState();
    const first = saveState(io, "state.json", state);
    state.viewState.query = "new query";
    const second = saveState(io, "state.json", state);
    await Promise.all([first, second]);
    assert.equal(
      (await loadState(io, "state.json")).viewState.query,
      "new query",
    );
  });
  it("rejects invalid card records, coordinates and future versions before import", () => {
    for (const items of [
      { bad: {} },
      { 1: { favorite: "yes" } },
      {
        1: {
          favorite: false,
          readingStatus: "read",
          colorOverride: null,
          updatedAt: 0,
          cover: {
            attachmentID: 2,
            source: "manual",
            page: 1,
            bbox: [0, 0, 2, 1],
            cacheKey: "",
          },
        },
      },
    ]) {
      assert.throws(
        () => importBackup({ ...createDefaultState(), items }),
        /invalid/i,
      );
    }
  });
  it("preserves a corrupt file and refuses to silently replace future state", async () => {
    const io = new MemoryIO();
    io.files.set("state.json", "{broken");
    await loadState(io, "state.json");
    assert.ok(
      [...io.files.keys()].some((key) => key.startsWith("state.json.corrupt-")),
    );
    io.files.set("state.json", '{"schemaVersion":99}');
    await assert.rejects(loadState(io, "state.json"), /unsupported/i);
  });
  it("migrates version zero and gives old layouts a light theme", () => {
    const migrated = importBackup({ schemaVersion: 0, items: {} });
    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.viewState.theme, "light");
  });
  it("creates a complete default state when the file is missing", async () => {
    const io = new MemoryIO();
    const state = await loadState(io, "state.json");

    assert.equal(state.schemaVersion, 1);
    assert.deepEqual(state.items, {});
    assert.equal(state.fieldMapping.memoField, null);
    assert.equal(state.viewState.sort, "recently-added");
  });

  it("round trips card state through an atomic replacement", async () => {
    const io = new MemoryIO();
    const state = createDefaultState();
    state.items[42] = {
      favorite: true,
      readingStatus: "reading",
      colorOverride: "blue",
      cover: null,
      updatedAt: 10,
    };

    await saveState(io, "state.json", state);
    assert.equal(io.files.has("state.json.tmp"), false);
    const restored = await loadState(io, "state.json");
    assert.deepEqual(restored.items[42], state.items[42]);
  });

  it("recovers from malformed JSON without throwing", async () => {
    const io = new MemoryIO();
    io.files.set("state.json", "{broken");

    const state = await loadState(io, "state.json");
    assert.deepEqual(state.items, {});
    assert.equal(state.schemaVersion, 1);
  });

  it("exports and validates a backup before importing it", () => {
    const state = createDefaultState();
    state.items[7] = {
      favorite: false,
      readingStatus: "read",
      colorOverride: null,
      cover: null,
      updatedAt: 2,
    };

    const backup = exportBackup(state);
    const restored = importBackup(backup);
    assert.deepEqual(restored, state);
    assert.throws(() => importBackup('{"schemaVersion":99}'), /unsupported/i);
  });
});
