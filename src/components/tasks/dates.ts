/** Calendar helpers for task screens (pure, `YYYY-MM-DD`). */
import { addDays } from "./format";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

const weekday = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
};

/** Monday and Sunday of the ISO week containing `date`. */
export function isoWeekRange(date: string): { from: string; to: string } {
  const from = addDays(date, -((weekday(date) + 6) % 7));
  return { from, to: addDays(from, 6) };
}

/** Group label for a due date: `오늘`, `내일` or `11.04 수`. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "오늘";
  if (date === addDays(today, 1)) return "내일";
  return `${date.slice(5, 7)}.${date.slice(8, 10)} ${WEEKDAY[weekday(date)]}`;
}
