import type { CardState, PluginState } from "../domain/types";
import { validateNormalizedCrop } from "../covers/manual-crop";

export interface StateIO {
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
  replace(tempPath: string, targetPath: string): Promise<void>;
}
const writes = new WeakMap<StateIO, Map<string, Promise<void>>>();
export function createDefaultState(): PluginState {
  return {
    schemaVersion: 1,
    items: {},
    colorRules: [],
    fieldMapping: { memoField: null },
    windowState: { width: 1440, height: 900, detailWidth: 420 },
    viewState: {
      scope: "current",
      query: "",
      sort: "recently-added",
      scrollTop: 0,
      theme: "light",
    },
  };
}
export function defaultCardState(): CardState {
  return {
    favorite: false,
    readingStatus: "unread",
    colorOverride: null,
    cover: null,
    updatedAt: 0,
  };
}
export async function loadState(
  io: StateIO,
  path: string,
): Promise<PluginState> {
  let raw: string;
  try {
    raw = await io.read(path);
  } catch (error) {
    if (/ENOENT|NotFound|no such file|not found/i.test(String(error)))
      return createDefaultState();
    throw error;
  }
  try {
    return importBackup(raw);
  } catch (error) {
    if (/Unsupported/.test(String(error))) throw error;
    await io.write(`${path}.corrupt-${Date.now()}`, raw);
    return createDefaultState();
  }
}
export async function saveState(
  io: StateIO,
  path: string,
  state: PluginState,
): Promise<void> {
  const contents = exportBackup(state);
  let paths = writes.get(io);
  if (!paths) {
    paths = new Map();
    writes.set(io, paths);
  }
  const previous = paths.get(path) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      await io.write(`${path}.tmp`, contents);
      await io.replace(`${path}.tmp`, path);
    });
  paths.set(path, next);
  try {
    await next;
  } finally {
    if (paths.get(path) === next) paths.delete(path);
  }
}
export function exportBackup(state: PluginState): string {
  return JSON.stringify(importBackup(state), null, 2);
}
export function importBackup(value: string | unknown): PluginState {
  const input = typeof value === "string" ? JSON.parse(value) : value;
  if (!record(input)) throw new Error("Invalid card library backup");
  if (input.schemaVersion !== 0 && input.schemaVersion !== 1)
    throw new Error("Unsupported card library state version");
  const state = createDefaultState();
  if (input.items !== undefined && !record(input.items)) invalid();
  for (const [id, raw] of Object.entries(input.items || {})) {
    if (
      !/^[1-9]\d*$/.test(id) ||
      !Number.isSafeInteger(Number(id)) ||
      !record(raw)
    )
      invalid();
    const card =
      input.schemaVersion === 0 ? { ...defaultCardState(), ...raw } : raw;
    if (
      typeof card.favorite !== "boolean" ||
      !["unread", "reading", "read"].includes(card.readingStatus) ||
      !finite(card.updatedAt) ||
      !color(card.colorOverride)
    )
      invalid();
    if (
      card.selectedAttachmentID !== undefined &&
      !positiveID(card.selectedAttachmentID)
    )
      invalid();
    if (card.cover !== null) {
      const c = card.cover;
      if (
        !record(c) ||
        !positiveID(c.attachmentID) ||
        !positiveID(c.page) ||
        !["candidate", "manual", "first-page"].includes(c.source) ||
        typeof c.cacheKey !== "string" ||
        !Array.isArray(c.bbox) ||
        c.bbox.length !== 4
      )
        invalid();
      try {
        validateNormalizedCrop(c.bbox as [number, number, number, number]);
      } catch {
        invalid();
      }
    }
    state.items[Number(id)] = JSON.parse(JSON.stringify(card));
  }
  if (input.colorRules !== undefined && !Array.isArray(input.colorRules))
    invalid();
  for (const rule of input.colorRules || []) {
    if (
      !record(rule) ||
      !["tag", "collection"].includes(rule.source) ||
      typeof rule.value !== "string" ||
      !rule.value ||
      !color(rule.color) ||
      rule.color === null ||
      !finite(rule.priority)
    )
      invalid();
    state.colorRules.push({
      source: rule.source,
      value: rule.value,
      color: rule.color,
      priority: rule.priority,
    });
  }
  if (input.fieldMapping !== undefined) {
    if (!record(input.fieldMapping)) invalid();
    const field = input.fieldMapping.memoField;
    if (
      field !== null &&
      (typeof field !== "string" || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(field))
    )
      invalid();
    state.fieldMapping.memoField = field;
  }
  if (input.windowState !== undefined) {
    if (!record(input.windowState)) invalid();
    for (const key of ["x", "y", "width", "height", "detailWidth"] as const) {
      if (input.windowState[key] !== undefined) {
        if (
          !finite(input.windowState[key]) ||
          (["width", "height", "detailWidth"].includes(key) &&
            input.windowState[key] <= 0)
        )
          invalid();
        state.windowState[key] = input.windowState[key];
      }
    }
  }
  if (input.viewState !== undefined) {
    const view = input.viewState;
    if (!record(view)) invalid();
    for (const key of ["scope", "query", "sort"] as const) {
      if (view[key] !== undefined) {
        if (typeof view[key] !== "string") invalid();
        state.viewState[key] = view[key];
      }
    }
    if (view.scrollTop !== undefined) {
      if (!finite(view.scrollTop) || view.scrollTop < 0) invalid();
      state.viewState.scrollTop = view.scrollTop;
    }
    if (view.theme !== undefined) {
      if (!["light", "dark"].includes(view.theme)) invalid();
      state.viewState.theme = view.theme;
    }
  }
  return state;
}
function record(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function positiveID(value: unknown): boolean {
  return finite(value) && Number.isSafeInteger(value) && value > 0;
}
function color(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "string" && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(value))
  );
}
function invalid(): never {
  throw new Error("Invalid card library backup data");
}
