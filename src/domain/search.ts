import type { PaperDTO } from "./metadata";

export function sortPapers(items: PaperDTO[], mode: string): PaperDTO[] {
  return [...items].sort((a, b) => {
    if (mode === "title") return a.title.localeCompare(b.title);
    if (mode === "author")
      return (a.authors[0] || "").localeCompare(b.authors[0] || "");
    if (mode === "year")
      return Number(b.year || 0) - Number(a.year || 0) || a.itemID - b.itemID;
    if (mode === "recently-opened")
      return (b.lastRead || 0) - (a.lastRead || 0) || b.itemID - a.itemID;
    return (
      (b.dateAdded || "").localeCompare(a.dateAdded || "") ||
      b.itemID - a.itemID
    );
  });
}

export function searchPapers(items: PaperDTO[], query: string): PaperDTO[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [
      item.title,
      item.authors.join(" "),
      item.publication,
      item.abstract,
      item.memo,
      item.tags.join(" "),
      item.notes.join(" "),
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
}
