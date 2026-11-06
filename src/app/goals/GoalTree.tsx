import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { GOAL_HORIZON, GOAL_STATUS } from "@/lib/enums";
import type { GoalNode } from "@/lib/repo/goals";
import { GoalProgress } from "./GoalProgress";
import { itemPath } from "@/lib/item-path";

/**
 * Goals as a collapsible tree (life → year → quarter). Open by default; achieved and
 * dropped goals start folded so the active ones stand out.
 */
export function GoalTree({ nodes, depth = 0 }: { nodes: GoalNode[]; depth?: number }) {
  return (
    <ul
      className={
        depth === 0 ? "flex flex-col gap-2" : "ml-5 flex flex-col border-l border-border pl-3"
      }
    >
      {nodes.map((node) => (
        <li key={node.goal.id}>
          <GoalRow node={node} depth={depth} />
        </li>
      ))}
    </ul>
  );
}

function GoalLine({ node }: { node: GoalNode }) {
  const { goal } = node;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm">
      <Badge tone={GOAL_HORIZON.tone(goal.horizon)}>{GOAL_HORIZON.label(goal.horizon)}</Badge>
      {goal.period ? <span className="text-xs text-muted tabular-nums">{goal.period}</span> : null}
      <Link
        href={itemPath("goals", goal.id, goal.title)}
        className={
          goal.status === "dropped"
            ? "min-w-0 truncate text-muted line-through hover:text-fg"
            : "min-w-0 truncate font-medium hover:underline"
        }
      >
        {goal.title}
      </Link>
      {goal.status !== "active" ? (
        <Badge tone={GOAL_STATUS.tone(goal.status)}>{GOAL_STATUS.label(goal.status)}</Badge>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {node.projects.length ? (
          <span className="text-xs text-muted">프로젝트 {node.projects.length}</span>
        ) : null}
        <GoalProgress value={node.progress} />
      </span>
    </span>
  );
}

function GoalRow({ node, depth }: { node: GoalNode; depth: number }) {
  if (!node.children.length) {
    return (
      <div className="flex items-center gap-1 pl-5">
        <GoalLine node={node} />
      </div>
    );
  }
  return (
    <details open={node.goal.status === "active"} className="group">
      <summary
        className="flex cursor-pointer list-none items-center gap-1 rounded-md hover:bg-surface [&::-webkit-details-marker]:hidden"
        aria-label={`${node.goal.title} 하위 목표 ${node.children.length}개 접기/펼치기`}
      >
        <span
          aria-hidden
          className="w-4 text-center text-xs text-muted transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <GoalLine node={node} />
      </summary>
      <GoalTree nodes={node.children} depth={depth + 1} />
    </details>
  );
}
