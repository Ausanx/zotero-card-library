import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { formatDetailAuthors } from "../../src/ui/detail-view";
import { createDetailView } from "../../src/ui/detail-view";
import { JSDOM } from "jsdom";
import { paper } from "../fixtures/paper";

describe("detail view", () => {
  it("opens metadata immediately and only requests candidates when asked", async () => {
    const { window } = new JSDOM();
    let requests = 0;
    const view = createDetailView({
      document: window.document,
      candidates: async () => {
        requests++;
        return [
          {
            attachmentID: 3,
            page: 1,
            bbox: [0, 0, 1, 1],
            caption: "Figure 1",
            score: 1,
            previewPath: "data:image/png;base64,eA==",
          },
        ];
      },
    });
    window.document.body.append(view.element);
    view.show({ ...paper, attachmentPath: "/paper.pdf" });
    await Promise.resolve();
    assert.equal(requests, 0);
    assert.equal(
      view.element.querySelector(".zcl-detail-title")?.textContent,
      paper.title,
    );
    const load = view.element.querySelector(
      '[data-action="load-candidates"]',
    ) as HTMLButtonElement;
    load.click();
    load.click();
    await Promise.resolve();
    assert.equal(requests, 1);
    assert.equal(view.element.querySelectorAll(".zcl-candidate").length, 1);
    view.destroy();
  });
  it("formats missing and multiple authors without adding placeholder fields", () => {
    assert.equal(formatDetailAuthors([]), "作者未知");
    assert.equal(
      formatDetailAuthors(["Ada Lovelace", "Grace Hopper"]),
      "Ada Lovelace；Grace Hopper",
    );
  });
});
