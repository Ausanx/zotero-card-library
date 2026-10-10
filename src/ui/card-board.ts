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
    reuse?: Set<number>;
  },
): void {
  const existing = options.reuse
    ? new Map(
        [...container.querySelectorAll<HTMLElement>(".zcl-card")].map(
          (card) => [Number(card.dataset.itemId), card],
        ),
      )
    : null;
  const cards = items.map((item) => {
    const state = states[item.itemID] || defaultCardState();
    return (
      (options.reuse?.has(item.itemID) && existing?.get(item.itemID)) ||
      renderCard(item, state, {
        ...options,
        coverUrl: options.covers?.get(item.itemID),
        selected: options.selection?.has(item.itemID),
        color: resolveColor(item, state, options.colorRules || []),
      })
    );
  });
  if (!options.reuse) {
    const fragment = options.document.createDocumentFragment();
    fragment.append(...cards);
    container.replaceChildren(fragment);
    return;
  }
  let next = container.firstElementChild;
  for (const card of cards) {
    if (card !== next) container.insertBefore(card, next);
    next = card.nextElementSibling;
  }
  while (next) {
    const remove = next;
    next = next.nextElementSibling;
    remove.remove();
  }
}
