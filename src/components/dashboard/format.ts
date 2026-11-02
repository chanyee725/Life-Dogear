/** Display helpers shared by the home dashboard and paper pages. */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-11-02` or an ISO timestamp → `2026. 11. 2.` (local date for timestamps). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = DATE_ONLY.exec(value);
  if (m) return `${Number(m[1])}. ${Number(m[2])}. ${Number(m[3])}.`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

/** Short relative time for recent activity: 방금 전, 5분 전, 3시간 전, 2일 전, else the date. */
export function formatRelative(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const date = new Date(value);
  const diff = now.getTime() - date.getTime();
  if (Number.isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatDate(value);
}

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
