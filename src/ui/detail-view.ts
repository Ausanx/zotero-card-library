import type { PaperDTO } from "../domain/metadata";
import type { CardState } from "../domain/types";
import type { FigureCandidate } from "../covers/candidate-engine";
import { defaultCardState } from "../data/state-store";
import { element, button, option } from "./dom";
import { normalizeCardColor } from "./card-view";
export type DetailViewOptions = {
  document: Document;
  onClose?: () => void;
  onOpenPDF?: (item: PaperDTO) => void;
  onState?: (item: PaperDTO, patch: Partial<CardState>) => void;
  onAttachment?: (item: PaperDTO, id: number) => void;
  onManualCrop?: (item: PaperDTO) => void;
  candidates?: (item: PaperDTO) => Promise<FigureCandidate[]>;
  onCandidate?: (item: PaperDTO, candidate: FigureCandidate) => void;
};
export function formatDetailAuthors(authors: string[]): string {
  return authors.length ? authors.join("；") : "作者未知";
}
export function createDetailView(options: DetailViewOptions) {
  const d = options.document;
  const view = element(d, "article", "zcl-detail-view");
  view.hidden = true;
  view.setAttribute("aria-label", "文献详情");
  const content = element(d, "div", "zcl-detail-content");
  view.append(content);
  let generation = 0;
  let metadata: HTMLElement;
  const hide = () => {
    generation++;
    view.hidden = true;
    options.onClose?.();
  };
  const escape = (event: KeyboardEvent) => {
    if (
      (event as KeyboardEvent).key === "Escape" &&
      !d.querySelector("dialog[open]")
    )
      hide();
  };
  d.addEventListener("keydown", escape);
  const show = (
    item: PaperDTO,
    state: CardState = defaultCardState(),
    cardColor?: string,
  ) => {
    const own = ++generation;
    const close = button(d, "×", hide, "zcl-detail-close");
    close.setAttribute("aria-label", "关闭详情");
    const header = element(d, "header", "zcl-detail-header");
    header.append(
      close,
      element(d, "p", "zcl-eyebrow", "文献详情"),
      element(d, "h1", "zcl-detail-title", item.title),
    );
    metadata = element(d, "div", "zcl-detail-metadata");
    const tools = element(d, "aside", "zcl-detail-tools");
    const layout = element(d, "div", "zcl-detail-layout");
    layout.append(metadata, tools);
    content.replaceChildren(header, layout);
    addSection("作者", formatDetailAuthors(item.authors));
    addSection(
      "期刊 / 出版物",
      [item.publication, item.year].filter(Boolean).join(" · ") || "未填写",
    );
    addSection("DOI", item.doi || "未填写");
    const controls = element(
      d,
      "section",
      "zcl-detail-section zcl-detail-controls",
    );
    const statusLabel = element(d, "label", "", "阅读状态");
    const status = element(d, "select");
    status.append(
      option(d, "unread", "未读"),
      option(d, "reading", "在读"),
      option(d, "read", "已读"),
    );
    status.value = state.readingStatus;
    status.addEventListener("change", () =>
      options.onState?.(item, {
        readingStatus: status.value as CardState["readingStatus"],
      }),
    );
    statusLabel.append(status);
    const colorLabel = element(d, "label", "", "卡片颜色");
    const color = element(d, "input");
    color.type = "color";
    color.value = normalizeCardColor(
      d,
      cardColor || state.colorOverride || "#e4eafb",
    );
    color.addEventListener("change", () =>
      options.onState?.(item, { colorOverride: color.value }),
    );
    colorLabel.append(color);
    controls.append(
      statusLabel,
      colorLabel,
      button(d, "恢复规则颜色", () =>
        options.onState?.(item, { colorOverride: null }),
      ),
    );
    tools.append(controls);
    addSection("简记", item.memo || "未填写简记；可在设置中指定其他来源字段。");
    addSection("摘要", item.abstract || "未填写");
    addSection("标签", item.tags.join("、") || "无标签");
    const noteText = item.notes
      .map((note) => {
        const template = element(d, "template");
        template.innerHTML = note;
        return template.content.textContent || "";
      })
      .join("\n\n");
    addSection("笔记", noteText || "无普通笔记");
    const attachments = element(d, "section", "zcl-detail-section");
    attachments.append(element(d, "h2", "", "PDF 附件"));
    const select = element(d, "select");
    select.setAttribute("aria-label", "封面与阅读的来源附件");
    for (const a of item.attachments)
      select.append(
        option(d, String(a.id), `${a.label}${a.path ? "" : "（本地不可用）"}`),
      );
    select.value = String(item.attachmentID);
    select.disabled = !item.attachments.length;
    select.addEventListener("change", () =>
      options.onAttachment?.(item, Number(select.value)),
    );
    attachments.append(select);
    if (!item.attachmentPath)
      attachments.append(
        element(
          d,
          "p",
          "zcl-hint",
          "本地 PDF 不可用。请在 Zotero 中下载附件或重新定位链接文件，然后刷新。",
        ),
      );
    const open = button(
      d,
      "在 Zotero 中打开 PDF",
      () => options.onOpenPDF?.(item),
      "zcl-primary-button",
    );
    open.disabled = !item.attachmentID;
    attachments.append(open);
    tools.append(attachments);
    const gallery = element(d, "section", "zcl-detail-section zcl-candidates");
    gallery.append(element(d, "h2", "", "封面候选"));
    tools.append(gallery);
    const manual = button(d, "手动框选 PDF 区域", () =>
      options.onManualCrop?.(item),
    );
    manual.disabled = !item.attachmentPath;
    gallery.append(manual);
    if (item.attachmentPath && options.candidates) {
      const message = element(
        d,
        "p",
        "zcl-hint",
        "需要更换封面时，再加载候选图。",
      );
      const load = button(d, "加载候选图", () => {
        load.disabled = true;
        message.textContent = "正在查找正文图片…";
        void options.candidates!(item)
          .then((candidates) => {
            if (own !== generation) return;
            message.textContent = candidates.length
              ? "点击候选图设为封面。"
              : "没有找到可靠候选，当前使用首页；也可以手动框选。";
            for (const candidate of candidates) {
              const pick = button(
                d,
                "",
                () => options.onCandidate?.(item, candidate),
                "zcl-candidate",
              );
              const image = element(d, "img");
              image.src = candidate.previewPath || "";
              image.alt = candidate.caption;
              pick.append(
                image,
                element(
                  d,
                  "span",
                  "",
                  `第 ${candidate.page} 页 · ${candidate.caption}`,
                ),
              );
              gallery.append(pick);
            }
          })
          .catch(() => {
            if (own === generation) {
              load.disabled = false;
              message.textContent =
                "候选图生成失败，请检查附件后重试，或手动框选。";
            }
          });
      });
      load.dataset.action = "load-candidates";
      gallery.append(load, message);
    }
    view.hidden = false;
  };
  function addSection(label: string, value: string) {
    const section = element(d, "section", "zcl-detail-section");
    section.append(element(d, "h2", "", label), element(d, "p", "", value));
    metadata.append(section);
  }
  return {
    element: view,
    show,
    hide,
    destroy: () => {
      generation++;
      d.removeEventListener("keydown", escape);
      view.remove();
    },
  };
}
