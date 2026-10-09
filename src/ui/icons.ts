const paths = {
  book: [
    "M12 5c-3-2-7-2-9 0v14c2-2 6-2 9 0 3-2 7-2 9 0V5c-2-2-6-2-9 0Z",
    "M12 5v14",
  ],
  grid: ["M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z"],
  folder: ["M3 7V5h6l2 2h10v13H3Z"],
  tag: ["M3 3h7l11 11-7 7L3 10Z", "M7 7h.01"],
  pdf: ["M14 2H5v20h14V7Z", "M14 2v5h5", "M8 13h8 M8 17h6"],
  arrow: ["M4 12h16", "m14 6 6 6-6 6"],
  image: ["M3 3h18v18H3Z", "m3 17 5-5 4 4 4-6 5 7", "M8 7h.01"],
  settings: [
    "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1",
    "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
  ],
  moon: ["M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"],
  search: ["M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "m15 15 6 6"],
} as const;
export function icon(document: Document, name: keyof typeof paths): Element {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("zcl-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const value of paths[name]) {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", value);
    svg.append(path);
  }
  return svg;
}
