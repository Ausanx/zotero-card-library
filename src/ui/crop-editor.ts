import type { CoverService, CoverResult } from "../covers/cover-service";
import { normalizeManualCrop, type BBox } from "../covers/manual-crop";
import { element, button } from "./dom";
export function openCropEditor(
  document: Document,
  covers: CoverService,
  id: number,
  onSave: (cover: CoverResult) => Promise<void>,
): void {
  const dialog = element(document, "dialog", "zcl-dialog zcl-crop-dialog");
  const heading = element(document, "h2", "", "手动选择封面");
  const message = element(
    document,
    "p",
    "zcl-hint",
    "在页面预览中拖动框选。保存只改变插件封面。",
  );
  const page = element(document, "input");
  page.type = "number";
  page.min = "1";
  page.value = "1";
  page.setAttribute("aria-label", "PDF 页码");
  const stage = element(document, "div", "zcl-crop-stage");
  const image = element(document, "img");
  image.alt = "PDF 页面预览";
  image.draggable = false;
  const overlay = element(document, "div", "zcl-crop-rectangle");
  overlay.hidden = true;
  stage.append(image, overlay);
  let bbox: BBox | null = null,
    start: [number, number] | null = null,
    generation = 0,
    ready = false;
  const save = button(
    document,
    "保存封面",
    () => {
      if (!bbox || !ready) return;
      save.disabled = true;
      void covers
        .choose(id, Number(page.value), bbox, "manual")
        .then(onSave)
        .then(() => dialog.close())
        .catch(() => {
          message.textContent = "保存失败，请重新选择后重试。";
          save.disabled = false;
        });
    },
    "zcl-primary-button",
  );
  save.disabled = true;
  const load = async () => {
    const own = ++generation;
    ready = false;
    bbox = null;
    save.disabled = true;
    overlay.hidden = true;
    try {
      const preview = await covers.pagePreview(id, Number(page.value));
      if (own !== generation || !dialog.isConnected) return;
      page.max = String(preview.pageCount);
      image.src = preview.url;
      ready = true;
      message.textContent = `第 ${page.value} / ${preview.pageCount} 页；拖动框选，或使用下方比例坐标。`;
    } catch {
      if (own === generation)
        message.textContent = "无法加载此页，请检查页码和本地 PDF。";
    }
  };
  const numeric = element(document, "div", "zcl-crop-coordinates");
  const fields = ["左", "上", "右", "下"].map((name, i) => {
    const label = element(document, "label", "", `${name} (%)`);
    const input = element(document, "input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.value = i < 2 ? "0" : "100";
    input.step = "1";
    label.append(input);
    numeric.append(label);
    input.addEventListener("change", () => {
      try {
        bbox = normalizeManualCrop(
          fields.map((f) => Number(f.value)) as BBox,
          100,
          100,
        );
        save.disabled = !ready;
        draw();
      } catch {
        save.disabled = true;
        message.textContent = "请设置有效矩形，宽和高至少为页面的 3%。";
      }
    });
    return input;
  });
  const draw = () => {
    if (!bbox) return;
    overlay.hidden = false;
    Object.assign(overlay.style, {
      left: `${bbox[0] * 100}%`,
      top: `${bbox[1] * 100}%`,
      width: `${(bbox[2] - bbox[0]) * 100}%`,
      height: `${(bbox[3] - bbox[1]) * 100}%`,
    });
    fields.forEach(
      (f, i) => (f.value = String(Math.round(bbox![i] * 1000) / 10)),
    );
  };
  const point = (event: PointerEvent): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    ];
  };
  stage.addEventListener("pointerdown", (event) => {
    if (!ready) return;
    start = point(event as PointerEvent);
    stage.setPointerCapture((event as PointerEvent).pointerId);
    event.preventDefault();
  });
  stage.addEventListener("pointermove", (event) => {
    if (!start) return;
    const end = point(event as PointerEvent);
    bbox = [
      Math.min(start[0], end[0]),
      Math.min(start[1], end[1]),
      Math.max(start[0], end[0]),
      Math.max(start[1], end[1]),
    ];
    draw();
  });
  stage.addEventListener("pointerup", () => {
    start = null;
    try {
      bbox = normalizeManualCrop(bbox!, 1, 1);
      save.disabled = false;
    } catch {
      save.disabled = true;
      message.textContent = "框选区域太小，请重新选择。";
    }
  });
  page.addEventListener("change", () => void load());
  dialog.append(
    heading,
    message,
    page,
    stage,
    numeric,
    save,
    button(document, "取消", () => dialog.close()),
  );
  document.body!.append(dialog);
  dialog.addEventListener("close", () => {
    generation++;
    dialog.remove();
  });
  dialog.showModal();
  void load();
}
