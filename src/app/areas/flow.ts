import type { MaterialVia } from "@/lib/repo/areas";
import type { GoalNode } from "@/lib/repo/goals";

/** "직접 연결" / "프로젝트 X 경유" / "목표 Y 경유", joined. */
export function viaLabel(via: readonly MaterialVia[]): string {
  return via
    .map((v) =>
      v.type === "member"
        ? "영역 소속"
        : v.type === "area"
          ? "직접 연결"
          : `${v.type === "project" ? "프로젝트" : "목표"} ${v.title} 경유`,
    )
    .join(" · ");
}

/** Goal ids of a goal forest in display (depth-first) order. */
export function goalOrder(nodes: readonly GoalNode[]): string[] {
  return nodes.flatMap((n) => [n.goal.id, ...goalOrder(n.children)]);
}

export type ProjectGroup<P> = {
  /** null: projects without a goal. */
  goalId: string | null;
  /** Goal title; for goals outside this area or archived, as known. */
  title: string | null;
  projects: P[];
};

/**
 * Projects grouped by the goal they work toward: the area's goals in tree order first,
 * then other goals by title, then projects without a goal. Project order is kept.
 */
export function groupProjectsByGoal<P extends { goalId: string | null }>(
  list: readonly P[],
  areaGoalOrder: readonly string[],
  goalTitles: ReadonlyMap<string, string>,
): ProjectGroup<P>[] {
  const groups = new Map<string | null, P[]>();
  for (const p of list) {
    const key = p.goalId && goalTitles.has(p.goalId) ? p.goalId : null;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const rank = (id: string | null) => {
    if (id === null) return [2, ""] as const;
    const i = areaGoalOrder.indexOf(id);
    return i >= 0
      ? ([0, String(i).padStart(6, "0")] as const)
      : ([1, goalTitles.get(id)!] as const);
  };
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const [ra, ka] = rank(a);
      const [rb, kb] = rank(b);
      return ra - rb || ka.localeCompare(kb, "ko");
    })
    .map(([goalId, projects]) => ({
      goalId,
      title: goalId ? goalTitles.get(goalId)! : null,
      projects,
    }));
}
