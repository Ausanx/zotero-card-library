import type { PaperDTO } from "./metadata";
import type { CardState, ColorRule, ReadingStatus } from "./types";

export function resolveColor(
  item: PaperDTO,
  state: CardState,
  rules: ColorRule[],
): string | null {
  if (state.colorOverride) return state.colorOverride;
  const ordered = [...rules].sort(
    (left, right) => left.priority - right.priority,
  );
  return (
    ordered.find(
      (rule) => rule.source === "tag" && item.tags.includes(rule.value),
    )?.color ||
    ordered.find(
      (rule) =>
        rule.source === "collection" &&
        item.collectionIDs?.includes(Number(rule.value)),
    )?.color ||
    null
  );
}

export function transitionReadingStatus(
  current: ReadingStatus,
  event: "pdf-opened" | "mark-read" | "mark-unread",
): ReadingStatus {
  if (event === "mark-read") return "read";
  if (event === "mark-unread") return "unread";
  return current === "unread" ? "reading" : current;
}
