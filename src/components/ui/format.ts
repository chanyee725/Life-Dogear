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
