import Link from "next/link";
import { DashboardSection } from "./DashboardSection";
import { GOALS_MAX, type QuarterGoal } from "./today";

/** Home "분기 목표" (4.3): active quarter goals with a thin progress bar. Hidden when empty. */
export function QuarterGoals({ goals }: { goals: QuarterGoal[] }) {
  if (!goals.length) return null;
  return (
    <DashboardSection
      id="quarter-goals"
      title="분기 목표"
      action={
        <Link href="/goals" className="text-[13px] text-muted hover:text-fg">
          목표 →
        </Link>
      }
    >
      <div className="flex flex-col">
        <ul className="flex flex-col">
          {goals.slice(0, GOALS_MAX).map((g) => (
            <li key={g.id} className="flex flex-col gap-1.5 py-1.5">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/goals/${encodeURIComponent(g.id)}`}
                  className="min-w-0 flex-1 truncate text-sm text-fg hover:underline"
                >
                  {g.title}
                </Link>
                {g.progress !== null ? (
                  <span className="text-xs text-muted tabular-nums">{g.progress}%</span>
                ) : null}
              </div>
              {g.progress !== null ? (
                <div
                  role="progressbar"
                  aria-label={`${g.title} 진행률`}
                  aria-valuenow={g.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1 overflow-hidden rounded-full bg-subtle"
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${g.progress}%` }}
                  />
                </div>
              ) : null}
              {g.basis ? <span className="text-xs text-muted tabular-nums">{g.basis}</span> : null}
            </li>
          ))}
        </ul>
        {goals.length > GOALS_MAX ? (
          <Link href="/goals" className="text-xs text-muted tabular-nums hover:text-fg">
            + {goals.length - GOALS_MAX}개 더
          </Link>
        ) : null}
      </div>
    </DashboardSection>
  );
}
