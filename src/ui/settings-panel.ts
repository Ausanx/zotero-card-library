import type { PluginState, ColorRule } from "../domain/types";
import type { NavigationData } from "./sidebar";
import { importBackup } from "../data/state-store";
import { element, button, option } from "./dom";
export function openSettings(
  document: Document,
  state: PluginState,
  navigation: NavigationData,
  actions: {
    save(next: PluginState): Promise<void>;
    export?(): Promise<void>;
    import?(): Promise<PluginState | null>;
  },
): void {
  const dialog = element(document, "dialog", "zcl-dialog");
  const draft = importBackup(state);
  dialog.append(element(document, "h2", "", "外观与本地设置"));
  const themeLabel = element(document, "label", "zcl-setting", "主题");
  const theme = element(document, "select");
  theme.append(
    option(document, "light", "浅色"),
    option(document, "dark", "深色"),
  );
  theme.value = state.viewState.theme;
  themeLabel.append(theme);
  const memoLabel = element(
    document,
    "label",
    "zcl-setting",
    "简记字段（Zotero 字段键）",
  );
  const memo = element(document, "input");
  memo.value = state.fieldMapping.memoField || "";
  memo.placeholder = "留空不映射，例如 extra / shortTitle";
  memoLabel.append(memo);
  dialog.append(
    themeLabel,
    memoLabel,
    element(
      document,
      "p",
      "zcl-hint",
      "普通笔记始终在详情中显示。请确认简记实际所在字段，再填写字段键。",
    ),
    element(document, "h3", "", "颜色规则"),
    element(
      document,
      "p",
      "zcl-hint",
      "单篇颜色优先，其次标签，再次合集。同类规则按从上到下的顺序匹配。",
    ),
  );
  const rules = element(document, "div", "zcl-rules");
  dialog.append(rules);
  const renderRules = () => {
    rules.replaceChildren();
    draft.colorRules.forEach((rule, index) => {
      const row = element(document, "div", "zcl-rule");
      const source = element(document, "select");
      source.setAttribute("aria-label", "规则来源");
      source.append(
        option(document, "tag", "标签"),
        option(document, "collection", "合集"),
      );
      source.value = rule.source;
      const value = element(document, "select");
      value.setAttribute("aria-label", "匹配标签或合集");
      const values =
        rule.source === "tag"
          ? navigation.tags.map((tag) => ({ value: tag, label: tag }))
          : navigation.collections.map((c) => ({
              value: String(c.id),
              label: c.name,
            }));
      if (!values.some((v) => v.value === rule.value))
        values.unshift({ value: rule.value, label: rule.value || "请选择" });
      for (const v of values) value.append(option(document, v.value, v.label));
      value.value = rule.value;
      value.addEventListener("change", () => (rule.value = value.value));
      source.addEventListener("change", () => {
        rule.source = source.value as ColorRule["source"];
        rule.value = "";
        renderRules();
      });
      const color = element(document, "input");
      color.type = "color";
      color.value = rule.color;
      color.setAttribute("aria-label", "规则颜色");
      color.addEventListener("change", () => (rule.color = color.value));
      const up = button(document, "上移", () => {
        [draft.colorRules[index - 1], draft.colorRules[index]] = [
          rule,
          draft.colorRules[index - 1],
        ];
        renderRules();
      });
      up.disabled = index === 0;
      row.append(
        source,
        value,
        color,
        up,
        button(document, "删除", () => {
          draft.colorRules.splice(index, 1);
          renderRules();
        }),
      );
      rules.append(row);
    });
  };
  renderRules();
  dialog.append(
    button(document, "添加规则", () => {
      draft.colorRules.push({
        source: "tag",
        value: navigation.tags[0] || "",
        color: "#55bfc4",
        priority: draft.colorRules.length,
      });
      renderRules();
    }),
  );
  const message = element(document, "p", "zcl-hint");
  message.setAttribute("role", "status");
  dialog.append(message);
  const run = (action: () => Promise<void>) => {
    void action().catch(() => {
      message.textContent =
        "操作失败：请检查字段键、规则和备份格式。原有设置未被替换。";
    });
  };
  dialog.append(
    button(
      document,
      "保存设置",
      () =>
        run(async () => {
          draft.viewState.theme = theme.value as "light" | "dark";
          draft.fieldMapping.memoField = memo.value.trim() || null;
          draft.colorRules.forEach((rule, index) => (rule.priority = index));
          await actions.save(importBackup(draft));
          dialog.close();
        }),
      "zcl-primary-button",
    ),
  );
  if (actions.export)
    dialog.append(
      button(document, "导出本地状态备份", () =>
        run(async () => {
          await actions.export!();
          message.textContent = "导出操作已结束。";
        }),
      ),
    );
  if (actions.import)
    dialog.append(
      element(
        document,
        "p",
        "zcl-hint",
        "导入备份会替换当前插件的收藏、阅读状态、封面和布局；不改动 Zotero 文献。",
      ),
      button(document, "选择并导入备份", () =>
        run(async () => {
          const next = await actions.import!();
          if (next) {
            await actions.save(next);
            dialog.close();
          }
        }),
      ),
    );
  dialog.append(button(document, "关闭", () => dialog.close()));
  document.body!.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}
