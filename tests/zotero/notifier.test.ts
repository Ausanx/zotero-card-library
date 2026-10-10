import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  registerLibraryNotifier,
  type NotifierObserver,
} from "../../src/zotero/notifier";

describe("library notifier", () => {
  it("retains every changed item ID while debouncing notifications", async () => {
    let observer: NotifierObserver | undefined;
    const changes: Array<{ type: string; ids: Array<string | number> }> = [];
    const unregister = registerLibraryNotifier(
      {
        registerObserver: (value) => {
          observer = value;
          return 1;
        },
        unregisterObserver: () => {},
      },
      (type, ids) => changes.push({ type, ids }),
      0,
    );
    observer!.notify("modify", "item", [1], {});
    observer!.notify("modify", "item", [2], {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(changes, [{ type: "item", ids: [1, 2] }]);
    unregister();
  });
  it("debounces supported changes and unregisters cleanly", async () => {
    let observer: NotifierObserver | undefined;
    let unregistered = -1;
    const events: string[] = [];
    const unregister = registerLibraryNotifier(
      {
        registerObserver: (value) => {
          observer = value;
          return 9;
        },
        unregisterObserver: (id) => {
          unregistered = id;
        },
      },
      (type) => events.push(type),
      0,
    );

    observer?.notify("modify", "item", [1], {});
    observer?.notify("modify", "item", [1], {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(events, ["item"]);
    unregister();
    assert.equal(unregistered, 9);
  });
});
