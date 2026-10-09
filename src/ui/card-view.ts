import type { PaperDTO } from "../domain/metadata";
import type { CardState } from "../domain/types";
import { element, button } from "./dom";
import { icon } from "./icons";
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
export function normalizeCardColor(d: Document, color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const probe = element(d, "span");
  probe.hidden = true;
  probe.style.color = color;
  const window = d.defaultView;
  const body = d.body;
  if (!probe.style.color || !window || !body) return "#e5d8af";
  body.append(probe);
  const channels = window
    .getComputedStyle(probe)
    ?.color.match(/[\d.]+/g)
    ?.map(Number);
  probe.remove();
  if (!channels || channels.length < 3) return "#e5d8af";
  const opacity = channels[3] ?? 1;
  const canvas = window
    .getComputedStyle(body)
    ?.backgroundColor.match(/[\d.]+/g)
    ?.map(Number);
  const background = canvas && canvas[3] !== 0 ? canvas : [250, 250, 250];
  return (
    "#" +
    channels
      .slice(0, 3)
      .map((channel, i) =>
        Math.round(channel * opacity + background[i] * (1 - opacity))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function resolveCardColor(
  item: PaperDTO,
  state: CardState,
  ruleColor?: string | null,
): string {
  return (
    ruleColor ||
    state.colorOverride ||
    (!item.attachmentPath
      ? "#d6d6d2"
      : state.readingStatus === "read"
        ? "#4d795f"
        : state.readingStatus === "reading"
          ? "#4f729c"
          : "#e5d8af")
  );
}
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
  const color = normalizeCardColor(
    d,
    resolveCardColor(item, state, options.color),
  );
  card.style.setProperty("--card-accent", color);
  const rgb = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    }) || [1, 1, 1];
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  card.style.setProperty(
    "--card-muted-opacity",
    luminance >= 0.45 ? "0.8" : "1",
  );
  const dark = luminance < 0.179;
  card.dataset.tone = dark ? "dark" : "light";
  card.style.setProperty(
    "--card-ink",
    dark ? "#ffffff" : luminance >= 0.45 ? "#30352f" : "#000000",
  );
  const readingStatus =
    state.readingStatus === "read"
      ? "已读"
      : state.readingStatus === "reading"
        ? "在读"
        : "未读";
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
  const top = element(d, "div", "zcl-card-top");
  const select = element(d, "input");
  select.type = "checkbox";
  select.checked = options.selected || false;
  select.setAttribute("aria-label", `选择：${item.title}`);
  select.addEventListener("click", (e) => e.stopPropagation());
  select.addEventListener("change", () =>
    options.onSelect?.(item, select.checked),
  );
  const publication = element(
    d,
    "span",
    "zcl-card-publication",
    item.publication || "未填写期刊",
  );
  publication.title = item.publication;
  top.append(publication, element(d, "span", "zcl-card-year", item.year));
  const favorite = button(
    d,
    state.favorite ? "★" : "☆",
    () => {},
    "zcl-icon-button",
  );
  favorite.dataset.action = "toggle-favorite";
  favorite.setAttribute("aria-label", state.favorite ? "取消收藏" : "收藏");
  favorite.setAttribute("aria-pressed", String(state.favorite));
  top.append(favorite, select);
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
  const media = element(d, "div", "zcl-card-media");
  const actions = element(d, "div", "zcl-card-actions");
  const action = (
    label: string,
    name: CardAction,
    symbol: "pdf" | "arrow" | "image",
  ) => {
    const node = button(d, "", () => {}, "zcl-card-action");
    node.dataset.action = name;
    node.append(icon(d, symbol), element(d, "span", "", label));
    actions.append(node);
    return node;
  };
  const open = action(
    item.attachmentID ? "打开 PDF" : "无 PDF",
    "open-pdf",
    "pdf",
  );
  open.disabled = !item.attachmentID;
  action("文献详情", "open-detail", "arrow");
  action("换封面", "change-cover", "image");
  actions.append(element(d, "span", "zcl-status-badge", readingStatus));
  media.append(cover, actions);
  card.append(top, title, authors, media);
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
