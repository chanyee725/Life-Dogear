import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { GOAL_HORIZON, GOAL_STATUS } from "@/lib/enums";
import { GoalProgress } from "./GoalProgress";
import type { ListGoal } from "./list-view";

/**
 * One compact row of the 목표 list: level and period in quiet text, the title, project
 * count and progress. `showStatus` adds the 달성/내려놓음 badge (the "끝난 목표" list).
 */
export function GoalListRow({
  goal,
  showStatus = false,
}: {
  goal: ListGoal;
  showStatus?: boolean;
}) {
  const dropped = goal.status === "dropped";
  return (
    <div className="flex min-h-9 items-center gap-2 py-1.5 text-sm sm:gap-3">
      {/* Narrow screens show the period alone (it tells year from quarter). */}
      <span className="flex w-[3.75rem] shrink-0 items-baseline gap-1.5 text-xs whitespace-nowrap text-muted tabular-nums sm:w-[5.5rem]">
        <span className={cn("w-6 shrink-0", goal.period && "hidden sm:inline")}>
          {GOAL_HORIZON.label(goal.horizon)}
        </span>
        {goal.period ? <span>{goal.period}</span> : null}
      </span>
      <Link
        href={`/goals/${goal.id}`}
        className={cn(
          "min-w-0 flex-1 truncate rounded-sm",
          dropped ? "text-muted line-through hover:text-fg" : "hover:underline",
        )}
      >
        {goal.title}
      </Link>
      {showStatus && goal.status !== "active" ? (
        <Badge tone={GOAL_STATUS.tone(goal.status)} className="shrink-0">
          {GOAL_STATUS.label(goal.status)}
        </Badge>
      ) : null}
      {goal.projectCount ? (
        <span className="hidden shrink-0 text-xs text-muted sm:inline">
          프로젝트 {goal.projectCount}
        </span>
      ) : null}
      {goal.progress !== null ? (
        <span className="flex shrink-0 justify-end sm:w-28">
          <span className="text-xs text-muted tabular-nums sm:hidden">{goal.progress}%</span>
          <GoalProgress value={goal.progress} className="hidden sm:inline-flex" />
        </span>
      ) : (
        <span aria-hidden className="hidden w-28 shrink-0 sm:block" />
      )}
    </div>
  );
}
