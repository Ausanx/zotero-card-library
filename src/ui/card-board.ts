import type { PaperDTO } from "../domain/metadata";
import type { CardState, ColorRule } from "../domain/types";
import { resolveColor } from "../domain/color-rules";
import { defaultCardState } from "../data/state-store";
import { renderCard, type CardViewOptions } from "./card-view";
export function computeColumnCount(
  boardWidth: number,
  detailWidth = 0,
): number {
  return Math.min(
    5,
    Math.max(2, Math.floor(Math.max(0, boardWidth - detailWidth) / 280)),
  );
}
export function getCardSummary(
  item: Pick<PaperDTO, "title" | "authors" | "publication" | "year">,
) {
  return {
    title: item.title.trim(),
    authors: item.authors.join(", "),
    publication: item.publication,
    year: item.year,
  };
}
export function renderBoard(
  container: HTMLElement,
  items: PaperDTO[],
  states: Record<number, CardState>,
  options: CardViewOptions & {
    covers?: Map<number, string>;
    selection?: Set<number>;
    colorRules?: ColorRule[];
  },
): void {
  const fragment = options.document.createDocumentFragment();
  for (const item of items) {
    const state = states[item.itemID] || defaultCardState();
    fragment.append(
      renderCard(item, state, {
        ...options,
        coverUrl: options.covers?.get(item.itemID),
        selected: options.selection?.has(item.itemID),
        color: resolveColor(item, state, options.colorRules || []),
      }),
    );
  }
  container.replaceChildren(fragment);
}
