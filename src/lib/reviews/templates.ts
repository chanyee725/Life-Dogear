/** Default bodies for new reviews (PLAN-GRAPH 5.5). Pure; goal titles come from the caller. */
import type { ReviewKind } from "@/lib/enums";

export type TemplateGoal = { title: string };

const goalLines = (goals: readonly TemplateGoal[], empty: string) =>
  goals.length
    ? goals
        .map((g) => `- ${g.title.replace(/\s+/g, " ").trim()}: 달성 / 진행 / 내려놓음 —`)
        .join("\n")
    : empty;

/**
 * - week: the four steps live in the screen; the body is the free memo.
 * - month: 잘 된 것 / 막힌 것 / 배운 것 / 다음 달.
 * - quarter: result per quarter goal + 배운 것 + 다음 분기 목표 초안.
 * - year: result per year goal + 인생 목표에 비춘 한 해 + 내년 연 목표 초안.
 */
export function reviewTemplate(kind: ReviewKind, goals: readonly TemplateGoal[] = []): string {
  switch (kind) {
    case "week":
      return "## 회고 메모\n\n";
    case "month":
      return "## 잘 된 것\n\n\n## 막힌 것\n\n\n## 배운 것\n\n\n## 다음 달\n\n";
    case "quarter":
      return `## 분기 목표 결과\n\n${goalLines(goals, "- (이번 분기 목표 없음)")}\n\n## 배운 것\n\n\n## 다음 분기 목표 초안\n\n`;
    case "year":
      return `## 연 목표 결과\n\n${goalLines(goals, "- (올해 목표 없음)")}\n\n## 인생 목표에 비춘 한 해\n\n\n## 내년 연 목표 초안\n\n`;
  }
}
