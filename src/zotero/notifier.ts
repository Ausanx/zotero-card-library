export type Notifier = {
  registerObserver: (
    observer: NotifierObserver,
    types: string[],
    name?: string,
  ) => number;
  unregisterObserver: (id: number) => void;
};

export type NotifierObserver = {
  notify: (
    event: string,
    type: string,
    ids: Array<string | number>,
    extraData: Record<string, unknown>,
  ) => void;
};

export function registerLibraryNotifier(
  notifier: Notifier,
  onChange: (type: string, ids: Array<string | number>) => void,
  delay = 80,
  onOpen?: (ids: Array<string | number>) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingType: string | null | undefined;
  const pendingIDs = new Set<string | number>();
  const observer: NotifierObserver = {
    notify(event, type, ids) {
      if (type === "file" && event === "open") onOpen?.(ids);
      if (
        ![
          "add",
          "modify",
          "delete",
          "move",
          "open",
          "close",
          "pageChange",
        ].includes(event)
      ) {
        return;
      }
      pendingType =
        pendingType === undefined || pendingType === type ? type : null;
      ids.forEach((id) => pendingIDs.add(id));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const changedType = pendingType;
        const changedIDs = [...pendingIDs];
        pendingType = undefined;
        pendingIDs.clear();
        onChange(changedType || "multiple", changedIDs);
      }, delay);
    },
  };
  const id = notifier.registerObserver(
    observer,
    ["item", "collection", "tag", "file", "collection-item", "item-tag"],
    "zcl",
  );
  return () => {
    if (timer) clearTimeout(timer);
    pendingIDs.clear();
    notifier.unregisterObserver(id);
  };
}
