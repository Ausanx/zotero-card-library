# Zotero Card Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source Zotero 9.0.6 plugin that opens a local EzRead-style card library window backed by Zotero metadata and PDF attachments.

**Architecture:** A bootstrapped Zotero plugin owns a separate card-library window. A read-only Zotero adapter produces normalized item DTOs; a versioned local JSON store holds card-only state; a pure JavaScript/PDF.js cover pipeline creates and caches Figure candidates; the UI renders a responsive waterfall board and a resizable detail drawer.

**Tech Stack:** TypeScript, Zotero Plugin Scaffold, Zotero 9.0.6 APIs, Zotero’s bundled PDF.js, native HTML/CSS, Vitest for pure logic tests, npm, and XPI packaging.

**Spec:** `docs/superpowers/specs/2026-10-09-zotero-card-library-design.md`

## Global Constraints

- Support Zotero 9.0.6 and compatible Zotero 9 releases only.
- Do not call an LLM, computer-vision model, remote service, or external AI API.
- Do not modify Zotero item fields, tags, notes, PDFs, annotations, or SQLite tables.
- Use Zotero as the only source of metadata and attachments.
- Store favorites, reading status, cover references, color overrides, and layout state in the plugin-owned local JSON store.
- Use PDF.js text coordinates and local geometric rules for cover candidates; fall back to the PDF first page only when no candidate exists.
- Default UI language is Simplified Chinese; provide light and dark themes, with light as the default.
- Publish source under MIT and preserve attribution for any copied EzRead code or styles.

## Review Focus

- A PDF with no local file must keep its metadata card and show an actionable unavailable-attachment state.
- A parent item with multiple PDF attachments must use a deterministic primary attachment and allow changing it.
- A complex two-column PDF must produce bounded candidate rectangles or an explicit manual-crop path without corrupting the PDF.
- A corrupt or older local state file must be migrated or safely replaced without losing Zotero data.
- Opening a PDF from either the card window or Zotero Reader must update the local reading state without treating a last-read timestamp as completion.

## File Map

- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `zotero-plugin.config.ts`, `.gitignore`, `.env.example`.
- Create: `addon/manifest.json`, `addon/content/card-library.xhtml`, `addon/content/card-library.css`, `addon/locale/zh-CN/zcl.ftl`, `addon/locale/en-US/zcl.ftl`.
- Create: `src/index.ts`, `src/bootstrap/lifecycle.ts`, `src/bootstrap/menu.ts`, `src/window/window-manager.ts`.
- Create: `src/domain/types.ts`, `src/domain/metadata.ts`, `src/domain/search.ts`, `src/domain/color-rules.ts`.
- Create: `src/data/state-store.ts`, `src/data/backup.ts`, `src/data/migrations.ts`.
- Create: `src/zotero/library-adapter.ts`, `src/zotero/notifier.ts`, `src/zotero/attachment-adapter.ts`.
- Create: `src/covers/pdf-adapter.ts`, `src/covers/candidate-engine.ts`, `src/covers/render-queue.ts`, `src/covers/cache.ts`, `src/covers/manual-crop.ts`.
- Create: `src/ui/app-controller.ts`, `src/ui/sidebar.ts`, `src/ui/card-board.ts`, `src/ui/card-view.ts`, `src/ui/detail-drawer.ts`, `src/ui/settings-panel.ts`.
- Create: `src/styles/tokens.css`, `src/styles/board.css`, `src/styles/drawer.css`, `src/styles/themes.css`.
- Create: `tests/domain/metadata.test.ts`, `tests/domain/search.test.ts`, `tests/domain/color-rules.test.ts`, `tests/data/state-store.test.ts`, `tests/covers/candidate-engine.test.ts`, `tests/covers/manual-crop.test.ts`.
- Create: `tests/ui/card-board.test.ts`, `tests/ui/detail-drawer.test.ts`.
- Create: `tests/fixtures/papers/figure-caption.pdf`, `tests/fixtures/papers/two-column.pdf`, `tests/fixtures/papers/no-figure.pdf`.
- Create: `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `docs/DEVELOPMENT.md`, `docs/PRIVACY.md`, `docs/RELEASE.md`.

### Task 1: Scaffold the Zotero 9 plugin

**Files:** Create the scaffold/config files in the file map; replace generated example modules with the project entry point.

**Interfaces:** Produces `src/index.ts` and a build that emits an installable XPI. Uses addon ID `zotero-card-library@zotero`, addon reference `zcl`, and displayed name `Zotero Card Library`.

- [ ] **Step 1: Add the scaffold configuration and scripts.**

  Configure `npm run test`, `npm run lint`, `npm run build`, and `npm run package`; set the Zotero minimum version to `9.0.6`; keep all runtime dependencies local to the XPI.

- [ ] **Step 2: Add the lifecycle entry point.**

  Export `startup`, `shutdown`, `install`, and `uninstall` from `src/index.ts`. `startup` must register the menu and window hooks; `shutdown` must unregister them and close the card window.

- [ ] **Step 3: Build the empty plugin.**

  Run `npm install` and `npm run build`.

  Expected: an XPI is emitted, the manifest declares Zotero 9.0.6 as the minimum, and no scaffold example menu remains.

- [ ] **Step 4: Commit the scaffold.**

  ```bash
  git add package.json package-lock.json tsconfig.json zotero-plugin.config.ts addon src .gitignore .env.example
  git commit -m "chore: scaffold Zotero card library plugin"
  ```

### Task 2: Define domain DTOs and the local state store

**Files:** Create `src/domain/types.ts`, `src/data/state-store.ts`, `src/data/backup.ts`, `src/data/migrations.ts`, and `tests/data/state-store.test.ts`.

**Interfaces:**

```ts
type ReadingStatus = "unread" | "reading" | "read";
type CoverSource = "candidate" | "manual" | "first-page";
type CoverReference = {
  attachmentID: number;
  source: CoverSource;
  page: number;
  bbox: [number, number, number, number];
  cacheKey: string;
};
type ColorRule = {
  source: "tag" | "collection";
  value: string;
  color: string;
  priority: number;
};
type CardState = {
  favorite: boolean;
  readingStatus: ReadingStatus;
  colorOverride: string | null;
  cover: CoverReference | null;
  updatedAt: number;
};
type PluginState = {
  schemaVersion: 1;
  items: Record<number, CardState>;
  colorRules: ColorRule[];
  fieldMapping: { memoField: string | null };
  windowState: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    detailWidth: number;
  };
  viewState: { scope: string; query: string; sort: string; scrollTop: number };
};
```

- [ ] **Step 1: Write failing migration and round-trip tests.**

  Cover missing files, malformed JSON, unknown future versions, default state creation, atomic save, export/import, and preservation of unrelated Zotero data.

- [ ] **Step 2: Implement `loadState()` and `saveState()`.**

  Resolve the plugin state path under the Zotero profile, write through a temporary file, replace atomically, and serialize writes so two UI events cannot overwrite each other.

- [ ] **Step 3: Implement backup and migration.**

  `exportBackup()` returns a versioned JSON object. `importBackup()` validates the schema, migrates version 0 to version 1, and rejects invalid item IDs without touching the live state.

- [ ] **Step 4: Run the focused tests.**

  ```bash
  npm run test -- tests/data/state-store.test.ts
  ```

  Expected: all state, migration, corruption, and atomic-write tests pass.

- [ ] **Step 5: Commit the state layer.**

  ```bash
  git add src/domain/types.ts src/data tests/data/state-store.test.ts
  git commit -m "feat: add versioned local card state"
  ```

### Task 3: Add the read-only Zotero adapter and notifier bridge

**Files:** Create `src/zotero/library-adapter.ts`, `src/zotero/attachment-adapter.ts`, `src/zotero/notifier.ts`, `src/domain/metadata.ts`, and `tests/domain/metadata.test.ts`.

**Interfaces:**

```ts
type LibraryScope =
  | { kind: "library" }
  | { kind: "collection"; collectionID: number }
  | { kind: "tag"; tag: string };
type PaperDTO = {
  itemID: number;
  title: string;
  authors: string[];
  publication: string;
  year: string;
  doi: string;
  abstract: string;
  tags: string[];
  notes: string[];
  memo: string;
  attachmentID: number | null;
  attachmentPath: string | null;
  lastRead: number | null;
};
interface LibraryAdapter {
  list(scope: LibraryScope): Promise<PaperDTO[]>;
  get(itemID: number): Promise<PaperDTO | null>;
  addToCollection(itemIDs: number[], collectionID: number): Promise<void>;
  openPDF(itemID: number, attachmentID?: number): Promise<void>;
}
```

- [ ] **Step 1: Write metadata normalization tests.**

  Test missing title, multiple creators, missing publication/year, tags, notes, configured memo field, parent/child attachment selection, linked files, and unavailable files.

- [ ] **Step 2: Implement read-only item and attachment adapters.**

  Read parent items through Zotero APIs, choose the deterministic primary PDF, expose alternative PDF attachments, and return `null` for a missing local path. Never call item save methods except `addToCollection()` for the explicit batch action.

- [ ] **Step 3: Implement field mapping.**

  Accept a configured Zotero field key for `memo`; until the user selects the actual “简记” field, return an empty memo string. Support title, creators, publication title, date/year, DOI, abstract, tags, notes, and last-read time.

- [ ] **Step 4: Implement notifier refresh.**

  Register one observer for item, collection, tag, and file changes. Debounce refresh requests and send normalized update messages to the card window. Unregister the observer on shutdown.

- [ ] **Step 5: Run metadata tests and commit.**

  ```bash
  npm run test -- tests/domain/metadata.test.ts
  git add src/zotero src/domain/metadata.ts tests/domain/metadata.test.ts
  git commit -m "feat: read Zotero library metadata"
  ```

### Task 4: Implement pure-local Figure candidates and cover caching

**Files:** Create `src/covers/pdf-adapter.ts`, `src/covers/candidate-engine.ts`, `src/covers/render-queue.ts`, `src/covers/cache.ts`, `src/covers/manual-crop.ts`, `tests/covers/candidate-engine.test.ts`, `tests/covers/manual-crop.test.ts`, and the PDF fixtures.

**Interfaces:**

```ts
type FigureCandidate = {
  attachmentID: number;
  page: number;
  bbox: [number, number, number, number];
  caption: string;
  score: number;
  previewPath: string | null;
};
interface CoverEngine {
  findCandidates(
    attachmentID: number,
    mode: "visible-card" | "detail",
  ): Promise<FigureCandidate[]>;
  renderRegion(
    attachmentID: number,
    page: number,
    bbox: [number, number, number, number],
  ): Promise<string>;
  renderFirstPage(attachmentID: number): Promise<string>;
}
```

- [ ] **Step 1: Add fixture assertions before implementation.**

  Assert that a captioned Figure produces bounded coordinates, a two-column fixture does not return a rectangle outside the page, a no-figure fixture returns an empty candidate list, and manual crop rejects reversed/out-of-range rectangles.

- [ ] **Step 2: Add the Zotero 9.0.6 PDF.js adapter.**

  Isolate access to bundled PDF.js behind `PdfAdapter`; expose text items, page dimensions, operator data needed by the rule engine, and page-region rendering. Do not access private Reader window objects from UI code.

- [ ] **Step 3: Implement caption and geometry rules.**

  Match English and Chinese Figure captions, group nearby text and drawing primitives, reject page-sized backgrounds, score `Fig. 1`/overview/system/framework candidates, and return the top three candidates sorted by score. Restrict the first pass to pages containing caption matches; when none are found, scan the complete document once.

- [ ] **Step 4: Implement lazy rendering and cache invalidation.**

  Queue only visible cards first, render previews in the background, key cache entries by attachment identity/fingerprint/page/bbox, and invalidate them when the attachment modification stamp changes. A missing PDF returns a typed unavailable result.

- [ ] **Step 5: Implement manual crop validation.**

  Normalize coordinates to `[0, 1]`, reject rectangles smaller than the minimum crop size or outside the page, and persist only the `CoverReference` in local state. The renderer always reopens the original PDF.

- [ ] **Step 6: Run cover tests and commit.**

  ```bash
  npm run test -- tests/covers/candidate-engine.test.ts tests/covers/manual-crop.test.ts
  git add src/covers tests/covers tests/fixtures
  git commit -m "feat: extract local PDF figure covers"
  ```

### Task 5: Build the card-library window shell and board UI

**Files:** Create `addon/content/card-library.xhtml`, `addon/content/card-library.css`, `src/window/window-manager.ts`, `src/ui/app-controller.ts`, `src/ui/sidebar.ts`, `src/ui/card-board.ts`, `src/ui/card-view.ts`, `src/styles/tokens.css`, `src/styles/board.css`, `src/styles/drawer.css`, `src/styles/themes.css`, and locale files.

**Interfaces:**

```ts
type BoardViewState = {
  scope: LibraryScope;
  query: string;
  sort: string;
  scrollTop: number;
};
type CardAction =
  | "toggle-favorite"
  | "open-detail"
  | "change-cover"
  | "open-pdf";
function renderBoard(items: PaperDTO[], state: BoardViewState): void;
function renderCard(item: PaperDTO, cardState: CardState): HTMLElement;
```

- [ ] **Step 1: Add DOM-level render tests.**

  Assert card title/author/publication/year rendering, missing-image state, status badge, favorite button label, accessible card activation, and column recalculation when the detail drawer changes width.

- [ ] **Step 2: Implement the window manager.**

  Create one independent Zotero window, restore dimensions from local state, focus an existing window on repeated menu activation, and persist geometry on move/resize/close.

- [ ] **Step 3: Implement the left sidebar.**

  Render all-library/current-collection/tag scope, search input, sort selector, and color-rule/settings entry. Keep the sidebar data-driven so Zotero changes refresh it without duplicating library state.

- [ ] **Step 4: Implement the waterfall board.**

  Use a CSS grid/masonry-compatible column layout with 2–5 responsive columns, full title wrapping, `object-fit: contain` previews, stable skeletons while covers render, and no horizontal overflow.

- [ ] **Step 5: Implement card actions and keyboard access.**

  Make the whole card open details; keep explicit buttons for favorite, change cover, and open PDF; support Enter/Space activation and visible focus states.

- [ ] **Step 6: Implement light/dark themes and Simplified Chinese locale strings.**

  Use semantic color tokens so card category colors remain independent from the surrounding theme.

- [ ] **Step 7: Run UI unit tests, build, and commit.**

  ```bash
  npm run test -- tests/ui
  npm run build
  git add addon src/window src/ui src/styles
  git commit -m "feat: add Zotero card library window"
  ```

### Task 6: Add the detail drawer, filters, statuses, and batch collection action

**Files:** Modify `src/ui/app-controller.ts`, `src/ui/card-board.ts`, `src/ui/card-view.ts`; create `src/ui/detail-drawer.ts`, `src/ui/settings-panel.ts`, `src/domain/search.ts`, `src/domain/color-rules.ts`, and their tests.

**Interfaces:**

```ts
function searchPapers(items: PaperDTO[], query: string): PaperDTO[];
function resolveColor(
  item: PaperDTO,
  state: CardState,
  rules: ColorRule[],
): string;
function transitionReadingStatus(
  current: ReadingStatus,
  event: "pdf-opened" | "mark-read" | "mark-unread",
): ReadingStatus;
```

- [ ] **Step 1: Write search, color, and status tests.**

  Cover title/author/publication/tag/abstract/note/memo search, rule precedence, automatic unread-to-reading transition, explicit read/unread actions, and favorite persistence.

- [ ] **Step 2: Implement the detail drawer.**

  Add draggable width, close behavior, metadata sections, memo/abstract/note previews, three-cover candidate gallery, primary-attachment selector, manual crop entry, and the Open PDF action.

- [ ] **Step 3: Implement filtering and sorting.**

  Keep query/scope/sort/scroll in `viewState`; debounce searches; derive “recently opened” from Zotero `lastRead` and do not infer completion from it.

- [ ] **Step 4: Implement local color rules and reading status controls.**

  Add settings controls for rule order, per-item color override, theme, and status. Save through the state store queue.

- [ ] **Step 5: Implement multi-select and batch Add to Collection.**

  Add selection checkboxes and a batch toolbar; require an explicit collection choice; call only `LibraryAdapter.addToCollection()` for the Zotero write.

- [ ] **Step 6: Run focused tests and commit.**

  ```bash
  npm run test -- tests/domain/search.test.ts tests/domain/color-rules.test.ts tests/ui
  git add src/domain src/ui tests
  git commit -m "feat: add card details and collection actions"
  ```

### Task 7: Add menus, lifecycle cleanup, backups, documentation, and release verification

**Files:** Modify `src/bootstrap/lifecycle.ts`, `src/bootstrap/menu.ts`, `src/index.ts`; create/update `README.md`, `CONTRIBUTING.md`, `docs/DEVELOPMENT.md`, `docs/PRIVACY.md`, `docs/RELEASE.md`, `LICENSE`, and `NOTICE`.

- [ ] **Step 1: Register and unregister the Zotero menu.**

  Add a Tools menu item and optional main-window toolbar action using the official menu registration API. Register on each main-window load and remove all listeners, timers, windows, and notifier observers on shutdown.

- [ ] **Step 2: Add backup/import UI.**

  Expose export and import from settings, validate the selected JSON before replacing live state, and show a success/error message without logging paper content.

- [ ] **Step 3: Document the open-source contract.**

  README must include installation from XPI, local development, Zotero 9.0.6 support, privacy behavior, state-file location, backup instructions, known Figure-detection limits, EzRead attribution, and troubleshooting for missing attachments. Development docs must explain the test profile and build commands.

- [ ] **Step 4: Add license and dependency audit.**

  Keep plugin source MIT. Record the licenses of the scaffold, Zotero types, PDF.js runtime, and any copied EzRead material in `NOTICE`; do not copy AGPL scaffold source into the plugin runtime without documenting its license implications.

- [ ] **Step 5: Run the release checks.**

  ```bash
  npm run lint
  npm run test
  npm run build
  npm run package
  ```

  Install the generated XPI into a clean Zotero 9.0.6 test profile and run the acceptance matrix from the spec: 238-item library, new item refresh, multiple PDFs, Figure/no-Figure PDFs, missing linked file, manual crop, backup restore, theme switch, detail resize, status transitions, batch collection action, uninstall, and offline use.

- [ ] **Step 6: Commit the release-ready documentation and packaging.**

  ```bash
  git add README.md CONTRIBUTING.md docs LICENSE NOTICE src addon package.json package-lock.json
  git commit -m "docs: prepare Zotero card library for open-source release"
  ```

## Execution Order

Run Tasks 1–4 first because the UI depends on stable DTOs, state, attachment selection, and cover references. Run Tasks 5–6 after the data and cover interfaces pass tests. Run Task 7 only after the full UI works in a clean Zotero 9.0.6 profile.

The plan deliberately keeps the first release as one plugin subsystem. The cover engine, state store, and UI are separate units with typed boundaries, but they ship together because none is useful to the user without the card window.
