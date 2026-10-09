import type { LibraryScope } from "../domain/types";
import { element, button } from "./dom";
import { icon } from "./icons";
export type NavigationData = {
  collections: { id: number; name: string }[];
  tags: string[];
  currentCollectionID?: number | null;
};
export type SidebarOptions = {
  document: Document;
  navigation: NavigationData;
  scope: string;
  query: string;
  theme: "light" | "dark";
  onScope(scope: LibraryScope): void;
  onQuery(query: string): void;
  onTheme(theme: "light" | "dark"): void;
  onSettings(): void;
};
export function renderSidebar(options: SidebarOptions): HTMLElement {
  const d = options.document;
  const sidebar = element(d, "aside", "zcl-sidebar");
  const brand = element(d, "div", "zcl-brand");
  brand.append(
    element(d, "span", "zcl-brand-mark"),
    element(d, "span", "", "文献卡片"),
  );
  brand.firstElementChild!.append(icon(d, "book"));
  sidebar.append(brand);
  const search = element(d, "input", "zcl-search");
  search.type = "search";
  search.value = options.query;
  search.placeholder = "搜索文献…";
  search.setAttribute("aria-label", "搜索文献");
  search.addEventListener("input", () => options.onQuery(search.value));
  const searchField = element(d, "div", "zcl-search-field");
  searchField.append(icon(d, "search"), search);
  sidebar.append(searchField);
  const nav = element(d, "nav", "zcl-scope-list");
  nav.setAttribute("aria-label", "文库与合集");
  const add = (label: string, scope: LibraryScope, key: string) => {
    const node = button(
      d,
      label,
      () => options.onScope(scope),
      `zcl-scope-button${key === options.scope ? " is-active" : ""}`,
    );
    node.prepend(
      icon(
        d,
        scope.kind === "library"
          ? "grid"
          : scope.kind === "collection"
            ? "folder"
            : "tag",
      ),
    );
    if (key === options.scope) node.setAttribute("aria-current", "page");
    nav.append(node);
  };
  nav.append(element(d, "div", "zcl-sidebar-heading", "文献库"));
  add("全部文献", { kind: "library" }, "library");
  if (options.navigation.currentCollectionID)
    add(
      "当前 Zotero 合集",
      {
        kind: "collection",
        collectionID: options.navigation.currentCollectionID,
      },
      `collection:${options.navigation.currentCollectionID}`,
    );
  nav.append(element(d, "div", "zcl-sidebar-heading", "合集"));
  for (const c of options.navigation.collections)
    add(
      c.name,
      { kind: "collection", collectionID: c.id },
      `collection:${c.id}`,
    );
  nav.append(element(d, "div", "zcl-sidebar-heading", "标签"));
  for (const tag of options.navigation.tags)
    add(tag, { kind: "tag", tag }, `tag:${tag}`);
  sidebar.append(nav);
  const footer = element(d, "div", "zcl-sidebar-footer");
  footer.append(
    button(d, "外观与设置", options.onSettings),
    button(d, options.theme === "dark" ? "切换浅色主题" : "切换深色主题", () =>
      options.onTheme(options.theme === "dark" ? "light" : "dark"),
    ),
  );
  footer.children[0].prepend(icon(d, "settings"));
  footer.children[1].prepend(icon(d, "moon"));
  sidebar.append(footer);
  return sidebar;
}
