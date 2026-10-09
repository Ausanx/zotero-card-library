import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  registerLibraryNotifier,
  type NotifierObserver,
} from "../../src/zotero/notifier";

describe("library notifier", () => {
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
