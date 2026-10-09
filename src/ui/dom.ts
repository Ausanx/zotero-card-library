export function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tag,
  ) as HTMLElementTagNameMap[K];
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
export function button(
  document: Document,
  label: string,
  action: () => void,
  className = "zcl-secondary-button",
): HTMLButtonElement {
  const node = element(document, "button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
export function option(
  document: Document,
  value: string,
  label: string,
): HTMLOptionElement {
  const node = element(document, "option", "", label);
  node.value = value;
  return node;
}
