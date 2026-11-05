/**
 * Pure display helpers for the home "프로젝트" cards. Safe on server and client.
 * `today` is the Seoul date (`YYYY-MM-DD`) decided once on the server (`seoulToday`).
 */
import { formatDue } from "@/components/tasks/format";

/** Days left before a due date counts as 임박 (orange). */
export const DUE_SOON_DAYS = 3;

export type DueChip = {
  /** Visible text: `D-24 · 11.29`, `D-day · 11.05` or `D+3 · 11.02`. */
  text: string;
  /** Spoken label from `formatDue`, e.g. `마감 지남, 2026년 11월 1일`. */
  label: string;
  /** Badge tone: gray (여유), orange (임박), red (지남). */
  tone: "gray" | "orange" | "red";
};

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD`, no timezone). */
export function daysBetween(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y!, m! - 1, day!);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** D-day chip for a project's due date; null when it has none. */
export function dueChip(dueDate: string | null | undefined, today: string): DueChip | null {
  const due = formatDue(dueDate, today);
  if (!due || !dueDate) return null;
  const left = daysBetween(today, dueDate);
  const days = left > 0 ? `D-${left}` : left === 0 ? "D-day" : `D+${-left}`;
  const text = `${days} · ${dueDate.slice(5, 7)}.${dueDate.slice(8, 10)}`;
  const tone = due.tone === "red" ? "red" : left <= DUE_SOON_DAYS ? "orange" : "gray";
  return { text, label: due.label, tone };
}

/** Done share of a project's tasks, 0–100 (0 when it has none). */
export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(done, total) / total) * 100);
}
