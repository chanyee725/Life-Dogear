import type { GoalHorizon, ReviewKind } from "@/lib/enums";
import { shiftPeriod } from "@/lib/reviews/period";

/** Goal a quarter/year review drafts: next quarter's or next year's. Null for week/month. */
export function nextGoalTarget(
  kind: ReviewKind,
  period: string,
): {
  horizon: "quarter" | "year";
  period: string;
  parentHorizon: GoalHorizon;
  parentPeriod: string | null;
} | null {
  if (kind === "quarter") {
    const next = shiftPeriod("quarter", period, 1);
    return {
      horizon: "quarter",
      period: next,
      parentHorizon: "year",
      parentPeriod: next.slice(0, 4),
    };
  }
  if (kind === "year") {
    return {
      horizon: "year",
      period: shiftPeriod("year", period, 1),
      parentHorizon: "life",
      parentPeriod: null,
    };
  }
  return null;
}
