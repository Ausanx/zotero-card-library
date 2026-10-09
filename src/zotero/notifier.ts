export type Notifier = {
  registerObserver: (observer: NotifierObserver, types: string[], priority?: number) => number;
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
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer: NotifierObserver = {
    notify(event, type, ids) {
      if (!["add", "modify", "delete", "move", "open", "close", "pageChange"].includes(event)) {
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        onChange(type, ids);
      }, delay);
    },
  };
  const id = notifier.registerObserver(observer, ["item", "collection", "tag", "file"]);
  return () => {
    if (timer) clearTimeout(timer);
    notifier.unregisterObserver(id);
  };
}
