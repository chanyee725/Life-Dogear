import { openReview } from "@/app/reviews/actions";
import { periodOf } from "@/lib/reviews/period";

/**
 * One line on home when the weekly review is due and not written yet: on Sunday for
 * this week, on Monday for last week (`weeklyReviewDue`). Writing opens or creates it.
 */
export function WeeklyReviewLine({ period, today }: { period: string | null; today: Date }) {
  if (!period) return null;
  const label = period === periodOf("week", today) ? "이번 주 회고" : "지난주 회고";
  return (
    <form action={openReview} className="text-[13px] text-muted">
      <input type="hidden" name="kind" value="week" />
      <input type="hidden" name="period" value={period} />
      <button type="submit" className="hover:text-fg">
        <span className="font-medium text-fg">{label}</span>를 아직 쓰지 않았습니다. 쓰기 →
      </button>
    </form>
  );
}
