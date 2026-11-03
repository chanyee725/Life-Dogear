import Link from "next/link";
import { GoalProgress } from "@/app/goals/GoalProgress";
import { DashboardEmpty, DashboardSection } from "./DashboardSection";
import type { QuarterGoal } from "./today";

/** Home "이번 분기 목표": active quarter goals with their progress. */
export function QuarterGoals({ goals }: { goals: QuarterGoal[] }) {
  return (
    <DashboardSection
      id="quarter-goals"
      title="이번 분기 목표"
      action={
        <Link href="/goals" className="text-xs text-muted hover:text-fg">
          모두 보기
        </Link>
      }
    >
      {goals.length === 0 ? (
        <DashboardEmpty>진행 중인 이번 분기 목표가 없습니다.</DashboardEmpty>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-1.5 text-sm">
              <Link href={`/goals/${encodeURIComponent(g.id)}`} className="min-w-0 flex-1 truncate text-fg hover:underline">
                {g.title}
              </Link>
              <GoalProgress value={g.progress} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
