/** Display helpers shared by the home dashboard and paper pages. */

// Dates follow the app-wide rule in `@/components/ui/format`.
export { formatDate, formatRelative } from "@/components/ui/format";

/** `["Kim", "Lee", "Park"]` → `Kim 외 2명`. */
export function formatAuthors(authors: readonly string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  return `${authors[0]} 외 ${authors.length - 1}명`;
}

/** Author · year · venue, skipping empty parts. */
export function paperByline(paper: {
  authors: readonly string[];
  year: number | null;
  venue: string | null;
}): string {
  return [formatAuthors(paper.authors), paper.year ?? "", paper.venue ?? ""]
    .filter(Boolean)
    .join(" · ");
}
