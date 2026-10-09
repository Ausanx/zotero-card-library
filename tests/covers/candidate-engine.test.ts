import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  findFigureCandidates,
  type PdfPageSnapshot,
} from "../../src/covers/candidate-engine";

describe("figure candidate engine", () => {
  it("groups adjacent figure panels instead of cropping to one embedded piece", () => {
    const candidates = findFigureCandidates(1, [
      {
        page: 1,
        width: 600,
        height: 800,
        textItems: [
          { text: "Figure 1. System overview", x: 60, y: 500, width: 450 },
        ],
        graphics: [
          { kind: "path", bbox: [60, 240, 210, 460] },
          { kind: "path", bbox: [250, 240, 390, 460] },
          { kind: "image", bbox: [430, 240, 560, 460] },
        ],
      },
    ]);
    assert.deepEqual(candidates[0].bbox, [0.1, 0.3, 560 / 600, 0.575]);
  });
  it("finds a bounded image region near an English figure caption", () => {
    const pages: PdfPageSnapshot[] = [
      {
        page: 1,
        width: 600,
        height: 800,
        textItems: [
          {
            text: "Figure 1. Overview of the proposed framework",
            x: 80,
            y: 610,
            width: 280,
            height: 16,
          },
        ],
        graphics: [{ bbox: [90, 180, 510, 570], kind: "image" }],
      },
    ];

    const candidates = findFigureCandidates(7, pages);

    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates[0].bbox, [
      90 / 600,
      180 / 800,
      510 / 600,
      570 / 800,
    ]);
    assert.match(candidates[0].caption, /Figure 1/);
    assert.ok(candidates[0].score > 0);
  });

  it("keeps two-column candidates inside the page and returns at most three", () => {
    const pages: PdfPageSnapshot[] = [
      {
        page: 2,
        width: 1000,
        height: 1200,
        textItems: [
          { text: "图 2. 系统框架", x: 60, y: 940, width: 140, height: 16 },
          {
            text: "Fig. 3. Experimental results",
            x: 540,
            y: 940,
            width: 180,
            height: 16,
          },
        ],
        graphics: [
          { bbox: [20, 500, 480, 900], kind: "image" },
          { bbox: [520, 500, 980, 900], kind: "path" },
          { bbox: [-10, 0, 1010, 1300], kind: "background" },
          { bbox: [0, 0, 1, 1], kind: "noise" },
        ],
      },
    ];

    const candidates = findFigureCandidates(8, pages);

    assert.ok(candidates.length <= 3);
    for (const candidate of candidates) {
      assert.ok(candidate.bbox.every((value) => value >= 0 && value <= 1));
      assert.ok(candidate.bbox[2] > candidate.bbox[0]);
      assert.ok(candidate.bbox[3] > candidate.bbox[1]);
    }
  });

  it("returns no candidates when a document has no figure caption", () => {
    const pages: PdfPageSnapshot[] = [
      {
        page: 1,
        width: 600,
        height: 800,
        textItems: [
          {
            text: "This page contains body text only",
            x: 40,
            y: 720,
            width: 220,
            height: 12,
          },
        ],
        graphics: [{ bbox: [40, 40, 560, 760], kind: "background" }],
      },
    ];

    assert.deepEqual(findFigureCandidates(9, pages), []);
  });
});
