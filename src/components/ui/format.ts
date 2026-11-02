/**
 * Date display rules, shared by every screen:
 * - Calendar dates (due date, seminar date) are always absolute: `YYYY.MM.DD`.
 * - Activity timestamps (created, updated, last read) are relative within 7 days
 *   (방금 전 · 5분 전 · 3시간 전 · 2일 전) and absolute after that.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `YYYY.MM.DD` for an ISO timestamp (local time) or a `YYYY-MM-DD` date (as-is, no timezone shift).
 * Empty input gives "".
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) return `${ymd[1]}.${ymd[2]}.${ymd[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/** Activity timestamp: relative within 7 days, else `formatDate`. */
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
