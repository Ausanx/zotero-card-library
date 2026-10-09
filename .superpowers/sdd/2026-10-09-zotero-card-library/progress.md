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
