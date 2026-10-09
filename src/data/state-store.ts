import type { PluginState } from "../domain/types";

export interface StateIO {
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
  replace(tempPath: string, targetPath: string): Promise<void>;
}

const CURRENT_VERSION = 1 as const;

export function createDefaultState(): PluginState {
  return {
    schemaVersion: CURRENT_VERSION,
    items: {},
    colorRules: [],
    fieldMapping: { memoField: null },
    windowState: { width: 1440, height: 900, detailWidth: 420 },
    viewState: {
      scope: "library",
      query: "",
      sort: "recently-added",
      scrollTop: 0,
    },
  };
}

export async function loadState(io: StateIO, path: string): Promise<PluginState> {
  try {
    const raw = await io.read(path);
    return normalizeState(JSON.parse(raw));
  } catch (_error) {
    return createDefaultState();
  }
}

export async function saveState(
  io: StateIO,
  path: string,
  state: PluginState,
): Promise<void> {
  const tempPath = `${path}.tmp`;
  await io.write(tempPath, JSON.stringify(normalizeState(state), null, 2));
  await io.replace(tempPath, path);
}

export function exportBackup(state: PluginState): string {
  return JSON.stringify(normalizeState(state), null, 2);
}

export function importBackup(value: string | unknown): PluginState {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid card library backup");
  }
  return normalizeState(parsed);
}

function normalizeState(value: unknown): PluginState {
  if (!value || typeof value !== "object") return createDefaultState();
  const input = value as Partial<PluginState> & { schemaVersion?: unknown };
  if (input.schemaVersion !== CURRENT_VERSION) {
    throw new Error("Unsupported card library state version");
  }

  const defaults = createDefaultState();
  return {
    schemaVersion: CURRENT_VERSION,
    items: isRecord(input.items) ? (input.items as PluginState["items"]) : {},
    colorRules: Array.isArray(input.colorRules) ? input.colorRules : [],
    fieldMapping:
      input.fieldMapping && typeof input.fieldMapping === "object"
        ? {
            memoField:
              typeof input.fieldMapping.memoField === "string"
                ? input.fieldMapping.memoField
                : null,
          }
        : defaults.fieldMapping,
    windowState: {
      ...defaults.windowState,
      ...(input.windowState && typeof input.windowState === "object"
        ? input.windowState
        : {}),
    },
    viewState: {
      ...defaults.viewState,
      ...(input.viewState && typeof input.viewState === "object"
        ? input.viewState
        : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
