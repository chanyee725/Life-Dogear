/**
 * Task due-date display (docs/design/today.md §1). Pure; safe on server and client.
 * `today` is the local date (`YYYY-MM-DD`) decided once on the server.
 */
import { formatDate } from "@/components/ui/format";
import { ITEM_ROUTE } from "@/lib/enums";

/** Page of a task's parent, or null for inbox tasks. */
export const parentHref = (t: {
  parentType: "project" | "goal" | "area" | null;
  parentId: string | null;
}): string | null =>
  t.parentType && t.parentId ? `${ITEM_ROUTE[t.parentType]}/${t.parentId}` : null;

export type DueTone = "muted" | "amber" | "red";

export type DueDisplay = {
  /** Visible text: `지남 · 2026.11.01`, `오늘`, `내일` or `2026.11.07`. */
  text: string;
  /** Spoken label, e.g. `마감 지남, 2026년 11월 1일`. */
  label: string;
  tone: DueTone;
  /** Tailwind classes for the tone and weight (includes size and tabular numbers). */
  className: string;
};

const TONE_CLASS: Record<DueTone, string> = {
  muted: "text-muted",
  amber: "text-tone-amber-fg font-medium",
  red: "text-tone-red-fg font-medium",
};

const BASE = "text-xs tabular-nums whitespace-nowrap";

/** `YYYY-MM-DD` of the day after `date` (calendar arithmetic, no timezone). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

/** Local calendar date `YYYY-MM-DD` of `now`. */
export function localDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function spoken(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** Due-date text and tone; null when there is no due date. */
export function formatDue(
  dueDate: string | null | undefined,
  today: string,
  done = false,
): DueDisplay | null {
  if (!dueDate) return null;
  const make = (text: string, label: string, tone: DueTone): DueDisplay => ({
    text,
    label,
    tone,
    className: `${BASE} ${TONE_CLASS[tone]}`,
  });
  const date = formatDate(dueDate);
  if (done) return make(date, `마감 ${spoken(dueDate)}`, "muted");
  if (dueDate < today) return make(`지남 · ${date}`, `마감 지남, ${spoken(dueDate)}`, "red");
  if (dueDate === today) return make("오늘", "마감 오늘", "amber");
  if (dueDate === addDays(today, 1)) return make("내일", "마감 내일", "muted");
  return make(date, `마감 ${spoken(dueDate)}`, "muted");
}
