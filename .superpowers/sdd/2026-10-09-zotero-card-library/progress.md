# SDD ledger — plan: docs/superpowers/plans/2026-10-09-zotero-card-library.md

## Setup

- Execution mode: Native inline implementation.
- Worktree ruling: the repository was created for this task and contained only approved design/plan commits; user explicitly authorized direct implementation, so implementation proceeds on `feature/zotero-card-library` in the current checkout instead of creating a second worktree.
- Spec: `docs/superpowers/specs/2026-10-09-zotero-card-library-design.md`
- Plan: `docs/superpowers/plans/2026-10-09-zotero-card-library.md`

## Pre-flight shared interfaces

- Task 1 → Task 2: scaffold output provides the TypeScript/test/build runtime; Task 2 will define domain/state modules independently of Zotero globals.
- Task 2 → Task 3: `PluginState`, `CardState`, `CoverReference`, and `ReadingStatus` are consumed by Zotero DTO and notifier modules.
- Task 3 → Task 4: `PaperDTO.attachmentID` and `attachmentPath` feed the PDF/candidate adapter; primary attachment selection must remain deterministic.
- Task 2/3/4 → Task 5: state, paper DTOs, and `CoverEngine` outputs feed the board/card renderers.
- Task 5 → Task 6: card action and board interfaces are consumed by drawer, filtering, status, and batch collection controls.
- Task 6 → Task 7: lifecycle cleanup, settings, backup UI, and release verification consume all prior public interfaces.

## Rulings

- Ruling: use a feature branch in the current fresh repository — user authorized direct implementation and no unrelated working tree existed; cost if wrong: implementation would need to be moved to a separate worktree before merge.

Task 1: complete (commit 97fc706, tests: NODE_OPTIONS=--use-system-ca npm run build → passed)
Task 2: Ruling: use Mocha/Chai plus tsx instead of Vitest — the scaffold already provides Mocha and Chai, preserving the same isolated logic-test boundary with one fewer framework; cost if wrong: test command differs from the plan but behavior coverage remains equivalent.
Task 2: complete (commit 304e006, tests: npm test → 4 passing; NODE_OPTIONS=--use-system-ca npm run build → passed)
Task 3: complete (commit 39b78d2, tests: npm test → 12 passing; NODE_OPTIONS=--use-system-ca npm run build → passed)
Task 4: complete (tests: npm test → 22 passing; NODE_OPTIONS=--use-system-ca npm run build → passed)

Task 4 notes:

- Added pure local Figure caption/geometry candidate extraction with English and Chinese caption rules, bounded normalized rectangles, top-three scoring, and first-page rendering fallback support through the PDF adapter.
- Added a PDF.js adapter boundary for text/operator inspection and canvas region rendering, a visible-first render queue, fingerprinted in-memory cover cache, and normalized manual crop validation.
- Added a regression test ensuring unordered multiple PDF attachments still open the deterministic primary attachment.

Task 5/6: resumed — native UI, drawers, filters, colors, PDF source/crop, status and collection actions implemented in prior chat; 48 unit/DOM tests pass on 2026-10-09. Final native acceptance is in progress.
Task 7: Ruling: keep new runtime under MIT and preserve adapted template development files under AGPL in NOTICE — upstream template is AGPL, so relicensing copied config without notice is inappropriate; cost if wrong: downstream developers must review mixed source licensing before redistribution.
Task 7: Ruling: use example.invalid update URL for local build — Zotero 9 requires update_url, and the user has not supplied a release repository; cost if wrong: manual updates until a real release endpoint is configured.
Task 7: Ruling: upgraded scaffold to 0.9.2 and Mocha to 12.0.3 — dependency audit found vulnerable archive/testing dependencies; cost if wrong: development requires the verified Node/tool versions. npm audit now reports zero vulnerabilities.
Task 5: fixed initial about:blank unload clearing WindowManager — regression test RED→GREEN; 48/48 suite passing.

Task 5: complete (48 unit/DOM tests, native singleton and card/drawer/theme/layout verification passed).
Task 6: complete (search/colors/status/actions/crop/backup and real native collection transaction verified; original title/tags/annotations preserved).
Task 7: complete (npm run lint:check, npm test 48/48, build + verify:package pass; npm audit 0 vulnerabilities; native 29 assertions passed). Native result: .scaffold/zotero-test-1791551537154/result.json.
Task 7: Ruling: headless file import uses injected file adapter and drag uses keyboard/coordinate controls — system picker, actual mouse/DPI and real scanned/multi-page literature remain manual release checks documented in docs/VERIFICATION.md; cost if wrong: local trial remains unverified on those paths.

Final review: independent read-only reviewer final_review reviewed d0761e3..3f22075; 0 Critical, 3 Important, 1 Minor.
Final: fixed future schema overwrite on failed startup/shutdown — tests/bootstrap/addon.test.ts RED→GREEN.
Final: fixed attachment switch while prior cover pending — tests/ui/app-controller.test.ts RED→GREEN.
Final: fixed settings snapshot rolling back Reader changes, including async-save interval — tests/ui/settings-panel.test.ts and app-controller.test.ts RED→GREEN. Full suite 52/52; lint/build/package pass.
Final: minor (deferred): Zotero getCreators() supplies creatorTypeID; editor/translator roles may appear as authors. Use getCreatorsJSON() in a future change.
Final: Ruling: native file-picker and actual mouse/DPI paths remain manual — injected validated backup and coordinate/keyboard interactions cover core behavior; cost if wrong: platform-specific interaction defects may remain in this trial.
Final: Ruling: real scanned/complex multi-page papers remain unverified — rule extraction has documented limits and manual crop fallback; cost if wrong: more papers need manual covers.
Final: Ruling: future Zotero upgrades and large real PDF libraries remain unverified — target is installed 9.0.6 and 238 synthetic records; cost if wrong: compatibility/performance needs a follow-up.
Final: Ruling: actual release/update endpoints and market review remain unverified — no owner/repository or publishing request provided; cost if wrong: current XPI uses manual updates only.
Final: Ruling: attribution is source-based, not a legal opinion or exhaustive provenance audit — preserved upstream license/config and independently implemented runtime; cost if wrong: maintainer must revisit notices before public distribution.
Final: Ruling: keep feature branch locally — user requested continuation and local completion; no Git remote configured; cost if wrong: user must choose integration/publishing separately.

Final verification: 52/52 unit/DOM tests, lint/build/package checks pass; final native 29/29 assertions pass at .scaffold/zotero-test-1791552246727/result.json. npm audit 0 vulnerabilities.

## 0.1.1 UI revision — 2026-10-09

- User requested EzRead reference styling and a separate detail window on card click; implemented directly on the existing branch.
- Rebuilt solid cream/blue/green/gray cards with 30 px corners, soft shadows, title above the image, adjacent vertical actions and compact navigation. Existing custom colors and rules take precedence.
- Replaced the drawer with a reusable native detail window, synchronized themes and preserved cover candidates, manual crop, PDF selection, state controls and cleanup.
- Independent UI review found two P2 issues: detail failures targeted the main window and short/named colors selected unreadable ink. Both reproduced RED then fixed GREEN. Follow-up checks fixed stale detail color controls after status/rule changes and secondary text contrast on mid-tone colors.
- Fresh verification: lint, 57/57 unit/DOM tests, build and XPI verification pass. Native acceptance: 43/43 assertions at `.scaffold/zotero-test-1791556516425/result.json`; four screenshots inspected without blocked text or overflowing actions.
- Environment: SWC default cache ACL rejected binding load; process-level custom native cache resolved it without dependency or ACL changes. Initial headless Zotero exited before driver execution; a fresh profile retry passed.
- Existing manual boundaries remain: system picker, actual mouse/DPI, real scanned/complex PDFs and future Zotero versions. No local data upload or publishing was performed.
