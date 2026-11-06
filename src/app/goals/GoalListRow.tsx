import Link from "next/link";
import { Badge, ListRow, cn } from "@/components/ui";
import { GOAL_HORIZON, GOAL_STATUS } from "@/lib/enums";
import { GoalProgress } from "./GoalProgress";
import { dueLabel, type ListGoal } from "./list-view";
import { itemPath } from "@/lib/item-path";

/** Left padding per sub-goal level (px), on top of the row's own padding. */
const INDENT = 24;

/**
 * One row of the 목표 list (a `ListRow`): level badge, period, title, area, progress and
 * days left to the period's end. Under `sm` the meta (area, progress, days) drops to a
 * second line so the title is never cut. `depth` indents sub-goals by the same step per
 * level; `showStatus` adds the 달성/내려놓음 badge (the "끝난 목표" list).
 */
export function GoalListRow({
  goal,
  today,
  areaTitle,
  depth = 0,
  showStatus = false,
}: {
  goal: ListGoal;
  /** `YYYY-MM-DD`, for the days-left label. */
  today: string;
  areaTitle?: string;
  depth?: number;
  showStatus?: boolean;
}) {
  const dropped = goal.status === "dropped";
  const due = goal.status === "active" ? dueLabel(goal.period, today) : null;
  return (
    <ListRow
      className="flex-wrap gap-x-3 gap-y-1 text-sm sm:flex-nowrap"
      style={depth ? { paddingLeft: 12 + depth * INDENT } : undefined}
    >
      <span className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
        <Badge tone={GOAL_HORIZON.tone(goal.horizon)} className="shrink-0">
          {GOAL_HORIZON.label(goal.horizon)}
        </Badge>
        {goal.period ? (
          <span className="shrink-0 text-xs text-muted tabular-nums">{goal.period}</span>
        ) : null}
        <Link
          href={itemPath("goals", goal.id, goal.title)}
          className={cn(
            "min-w-0 rounded-sm break-words sm:truncate",
            dropped ? "text-muted line-through hover:text-fg" : "font-medium hover:underline",
          )}
        >
          {goal.title}
        </Link>
        {showStatus && goal.status !== "active" ? (
          <Badge tone={GOAL_STATUS.tone(goal.status)} className="shrink-0">
            {GOAL_STATUS.label(goal.status)}
          </Badge>
        ) : null}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted">
        {areaTitle ? (
          <span className="max-w-24 truncate sm:max-w-32" title={areaTitle}>
            {areaTitle}
          </span>
        ) : null}
        <span className="flex w-28 justify-end sm:w-[11.5rem]">
          <GoalProgress
            value={goal.progress}
            barClassName="w-16 sm:w-36"
            valueClassName="w-9 text-right"
          />
        </span>
        <span className="min-w-11 shrink-0 text-right whitespace-nowrap tabular-nums">{due}</span>
      </span>
    </ListRow>
  );
}
