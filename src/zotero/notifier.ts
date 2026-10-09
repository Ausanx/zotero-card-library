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
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        onChange(type, ids);
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
    notifier.unregisterObserver(id);
  };
}
