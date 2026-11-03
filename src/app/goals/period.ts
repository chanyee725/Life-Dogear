import { GOAL_HORIZON, type GoalHorizon } from "@/lib/enums";

export const PERIOD_HINT = { year: "2027", quarter: "2027-Q1" } as const;

/** `2027-Q2` → { year: "2027", quarter: "Q2" }; empty → this year, Q1. */
export function splitPeriod(
  period: string | null,
  now = new Date(),
): { year: string; quarter: string } {
  const m = /^(\d{4})(?:-(Q[1-4]))?$/.exec(period ?? "");
  return { year: m?.[1] ?? String(now.getFullYear()), quarter: m?.[2] ?? "Q1" };
}

/** Period value sent with the form; life goals send "" (no period). */
export function joinPeriod(horizon: GoalHorizon, year: string, quarter: string): string {
  if (horizon === "life") return "";
  return horizon === "year" ? year : `${year}-${quarter}`;
}

/** "인생 목표", "2027 연 목표", "2027-Q1 분기 목표". */
export function goalLevelLabel(goal: { horizon: GoalHorizon; period: string | null }): string {
  const label = `${GOAL_HORIZON.label(goal.horizon)} 목표`;
  return goal.period ? `${goal.period} ${label}` : label;
}
