export type ReadingStatus = "unread" | "reading" | "read";

export type CoverSource = "candidate" | "manual" | "first-page";

export type CoverReference = {
  attachmentID: number;
  source: CoverSource;
  page: number;
  bbox: [number, number, number, number];
  cacheKey: string;
};

export type CardState = {
  favorite: boolean;
  readingStatus: ReadingStatus;
  colorOverride: string | null;
  cover: CoverReference | null;
  updatedAt: number;
};

export type ColorRule = {
  source: "tag" | "collection";
  value: string;
  color: string;
  priority: number;
};

export type LibraryScope =
  | { kind: "library" }
  | { kind: "collection"; collectionID: number }
  | { kind: "tag"; tag: string };

export type PluginState = {
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
  viewState: {
    scope: string;
    query: string;
    sort: string;
    scrollTop: number;
  };
};
