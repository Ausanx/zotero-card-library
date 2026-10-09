import type { PaperDTO } from "../domain/metadata";
import type { CardState } from "../domain/types";
import { element, button } from "./dom";
export type CardAction =
  | "toggle-favorite"
  | "open-detail"
  | "change-cover"
  | "open-pdf";
export type CardViewOptions = {
  document: Document;
  coverUrl?: string | null;
  color?: string | null;
  selected?: boolean;
  onAction?: (action: CardAction, item: PaperDTO) => void;
  onSelect?: (item: PaperDTO, selected: boolean) => void;
};
export function renderCard(
  item: PaperDTO,
  state: CardState,
  options: CardViewOptions,
): HTMLElement {
  const d = options.document;
  const card = element(
    d,
    "article",
    `zcl-card zcl-status-${state.readingStatus}`,
  );
  card.tabIndex = 0;
  card.dataset.itemId = String(item.itemID);
  card.setAttribute("aria-label", `查看详情：${item.title}`);
  card.style.setProperty(
    "--card-accent",
    options.color || state.colorOverride || "#55BFC4",
  );
  const cover = element(d, "div", "zcl-card-cover");
  if (options.coverUrl) {
    const image = element(d, "img");
    image.src = options.coverUrl;
    image.alt = `${item.title} 文献图片`;
    image.loading = "lazy";
    cover.append(image);
  } else {
    cover.classList.add("is-placeholder");
    cover.textContent = item.attachmentPath
      ? "正在生成封面…"
      : "本地 PDF 不可用";
  }
  card.append(cover);
  const body = element(d, "div", "zcl-card-body");
  const top = element(d, "div", "zcl-card-top");
  const select = element(d, "input");
  select.type = "checkbox";
  select.checked = options.selected || false;
  select.setAttribute("aria-label", `选择：${item.title}`);
  select.addEventListener("click", (e) => e.stopPropagation());
  select.addEventListener("change", () =>
    options.onSelect?.(item, select.checked),
  );
  top.append(
    element(
      d,
      "span",
      "zcl-card-publication",
      [item.publication, item.year].filter(Boolean).join(" · "),
    ),
    select,
  );
  const title = element(d, "h2", "zcl-card-title", item.title || "未命名文献");
  const authors = element(
    d,
    "p",
    "zcl-card-authors",
    item.authors.slice(0, 3).join("，") +
      (item.authors.length > 3 ? ` 等 ${item.authors.length} 人` : "") ||
      "作者未知",
  );
  authors.title = item.authors.join("；");
  body.append(top, title, authors);
  const footer = element(d, "div", "zcl-card-footer");
  footer.append(
    element(
      d,
      "span",
      "zcl-status-badge",
      state.readingStatus === "read"
        ? "已读"
        : state.readingStatus === "reading"
          ? "在读"
          : "未读",
    ),
  );
  const action = (label: string, name: CardAction, className: string) => {
    const node = button(d, label, () => {}, className);
    node.dataset.action = name;
    footer.append(node);
    return node;
  };
  const favorite = action(
    state.favorite ? "★" : "☆",
    "toggle-favorite",
    "zcl-icon-button",
  );
  favorite.setAttribute("aria-label", state.favorite ? "取消收藏" : "收藏");
  favorite.setAttribute("aria-pressed", String(state.favorite));
  action("换封面", "change-cover", "zcl-card-open-pdf");
  const open = action(
    item.attachmentID ? "打开 PDF" : "无 PDF",
    "open-pdf",
    "zcl-card-open-pdf",
  );
  open.disabled = !item.attachmentID;
  body.append(footer);
  card.append(body);
  card.addEventListener("click", (event) => {
    const action = (
      (event.target as HTMLElement).closest(
        "[data-action]",
      ) as HTMLElement | null
    )?.dataset.action as CardAction | undefined;
    options.onAction?.(action || "open-detail", item);
  });
  card.addEventListener("keydown", (event) => {
    if (
      event.target !== card ||
      !["Enter", " "].includes((event as KeyboardEvent).key)
    )
      return;
    event.preventDefault();
    options.onAction?.("open-detail", item);
  });
  return card;
}
