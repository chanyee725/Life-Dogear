import { formatRelative } from "@/components/ui/format";

/** Areas list sort, kept in `?sort=`. `order`: the user's (sidebar) order, the default. */
export const AREA_SORTS = [
  { value: "order", label: "사이드바 순" },
  { value: "recent", label: "최근 활동" },
  { value: "stale", label: "오래 방치된 순" },
] as const;
export type AreaSort = (typeof AREA_SORTS)[number]["value"];

export function parseAreaSort(value: string | undefined): AreaSort {
  return AREA_SORTS.some((s) => s.value === value) ? (value as AreaSort) : "order";
}

/** Days without activity after which an area is flagged as neglected. */
export const STALE_AFTER_DAYS = 14;

const DAY = 86_400_000;

/** Whole days between `iso` and `now` (0 within the first 24 hours; never negative). */
export function daysSince(iso: string, now: Date): number {
  const diff = now.getTime() - new Date(iso).getTime();
  return Number.isNaN(diff) ? 0 : Math.max(0, Math.floor(diff / DAY));
}

export type CareSignal = { stale: boolean; label: string };

/**
 * Right-hand signal of an area row: "N일째 손대지 않음" past {@link STALE_AFTER_DAYS},
 * otherwise a quiet relative time ("방금 전", "3시간 전", "9일 전").
 */
export function careSignal(lastActivity: string, now: Date): CareSignal {
  const days = daysSince(lastActivity, now);
  if (days > STALE_AFTER_DAYS) return { stale: true, label: `${days}일째 손대지 않음` };
  if (days < 1) return { stale: false, label: formatRelative(lastActivity, now) };
  return { stale: false, label: `${days}일 전` };
}

type Searchable = { title: string; standard: string };

const fold = (s: string) => s.normalize("NFC").toLowerCase();

/** Rows whose title or 유지 기준 contains every word of `query` (case-insensitive). */
export function filterAreas<T extends Searchable>(rows: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...rows];
  return rows.filter((r) => {
    const text = fold(`${r.title} ${r.standard}`);
    return words.every((w) => text.includes(w));
  });
}

/**
 * Rows in the chosen order. `order` keeps the given (sidebar) order; `recent` puts the
 * latest activity first, `stale` the oldest. Ties keep the sidebar order.
 */
export function sortAreas<T extends { lastActivity: string }>(
  rows: readonly T[],
  sort: AreaSort,
): T[] {
  if (sort === "order") return [...rows];
  const dir = sort === "recent" ? -1 : 1;
  // ISO timestamps order as plain strings.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => dir * cmp(a.row.lastActivity, b.row.lastActivity) || a.i - b.i)
    .map((x) => x.row);
}
