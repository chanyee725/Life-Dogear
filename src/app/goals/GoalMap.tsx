import Link from "next/link";
import type { GoalNode } from "@/lib/repo/goals";
import { goalLevelLabel } from "./period";

/**
 * 목표 지도: the same structure as the graph, as plain text —
 * goal → sub-goals → projects → (number of linked papers and seminars).
 */
export function GoalMap({ nodes }: { nodes: GoalNode[] }) {
  return (
    <ul className="flex flex-col gap-1 font-mono text-[13px] leading-6">
      {nodes.map((n) => (
        <MapNode key={n.goal.id} node={n} />
      ))}
    </ul>
  );
}

function MapNode({ node }: { node: GoalNode }) {
  return (
    <li>
      <Link
        href={`/goals/${node.goal.id}`}
        className="font-sans text-sm font-medium hover:underline"
      >
        {node.goal.title}
      </Link>
      <span className="ml-2 font-sans text-xs text-muted">
        {goalLevelLabel(node.goal)}
        {node.progress !== null ? ` · ${node.progress}%` : ""}
      </span>
      {node.children.length || node.projects.length ? (
        <ul className="ml-4 border-l border-border pl-3">
          {node.children.map((c) => (
            <MapNode key={c.goal.id} node={c} />
          ))}
          {node.projects.map((p) => (
            <li key={p.id} className="font-sans text-sm">
              <span aria-hidden className="mr-1 text-faint">
                ◇
              </span>
              <Link
                href={`/projects/${p.id}`}
                className={p.done ? "text-muted line-through hover:text-fg" : "hover:underline"}
              >
                {p.title}
              </Link>
              <span className="ml-2 text-xs text-muted">
                {p.resourceCount ? `자료 ${p.resourceCount}` : "자료 없음"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
