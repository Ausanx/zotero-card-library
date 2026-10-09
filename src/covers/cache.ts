export type CoverCacheKey = {
  attachmentID: number;
  fingerprint: string;
  page: number;
  bbox: [number, number, number, number];
};

export type CoverCache = {
  get: (key: CoverCacheKey) => string | null;
  set: (key: CoverCacheKey, value: string) => void;
  invalidateAttachment: (attachmentID: number, fingerprint?: string) => void;
  clear: () => void;
};

export function createCoverCache(): CoverCache {
  const values = new Map<string, string>();
  return {
    get: (key) => values.get(serializeKey(key)) || null,
    set: (key, value) => values.set(serializeKey(key), value),
    invalidateAttachment: (attachmentID, fingerprint) => {
      for (const key of values.keys()) {
        if (key.startsWith(`${attachmentID}:`) && (!fingerprint || key.startsWith(`${attachmentID}:${fingerprint}:`))) values.delete(key);
      }
    },
    clear: () => values.clear(),
  };
}

function serializeKey(key: CoverCacheKey): string {
  return `${key.attachmentID}:${key.fingerprint}:${key.page}:${key.bbox.map((value) => value.toFixed(5)).join(",")}`;
}
