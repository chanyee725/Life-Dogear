// Which stages and item branches are folded. Ids of stages and items share one set; both
// are opaque strings from the import, unique within a roadmap. RoadmapView owns the state
// (useTreeCollapse) and hands `collapsed` + `toggle` to RoadmapTree.

import { useCallback, useMemo, useState } from "react";

export type CollapsedSet = ReadonlySet<string>;

interface Branchy {
  id: string;
  children: Branchy[];
}

export function toggleCollapsed(set: CollapsedSet, id: string): CollapsedSet {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function setCollapsed(set: CollapsedSet, id: string, folded: boolean): CollapsedSet {
  if (set.has(id) === folded) return set;
  const next = new Set(set);
  if (folded) next.add(id);
  else next.delete(id);
  return next;
}

/** Every node with children, stages first then depth first. */
function branchIds(stages: Branchy[]): string[] {
  const out: string[] = [];
  const walk = (nodes: Branchy[]) => {
    for (const n of nodes) {
      if (n.children.length === 0) continue;
      out.push(n.id);
      walk(n.children);
    }
  };
  walk(stages);
  return out;
}

/** Default view: stages open (their items show), every item branch below folded. */
export function defaultCollapsed(stages: Branchy[]): CollapsedSet {
  const stageIds = new Set(stages.map((s) => s.id));
  return new Set(branchIds(stages).filter((id) => !stageIds.has(id)));
}

/** "모두 접기": every branch folded, stages included, so only stage rows show. */
export function collapseEverything(stages: Branchy[]): CollapsedSet {
  return new Set(branchIds(stages));
}

/** Every stage folded (items stay as they were). */
export function collapseAll(stageIds: string[]): CollapsedSet {
  return new Set(stageIds);
}

/** "모두 펼치기": nothing folded. */
export const expandAll = (): CollapsedSet => new Set();

export interface TreeCollapse {
  collapsed: CollapsedSet;
  toggle: (id: string) => void;
  /** Fold (true) or unfold (false) one node; no-op when already so. Used by the keyboard. */
  set: (id: string, folded: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** True when nothing is folded (label the "모두 펼치기/접기" button off this). */
  allExpanded: boolean;
}

/** Fold state for one roadmap; starts at defaultCollapsed. Key the owner by roadmap id. */
export function useTreeCollapse(stages: Branchy[]): TreeCollapse {
  const [collapsed, setSet] = useState<CollapsedSet>(() => defaultCollapsed(stages));
  const all = useMemo(() => collapseEverything(stages), [stages]);
  return {
    collapsed,
    toggle: useCallback((id: string) => setSet((s) => toggleCollapsed(s, id)), []),
    set: useCallback((id: string, folded: boolean) => setSet((s) => setCollapsed(s, id, folded)), []),
    expandAll: useCallback(() => setSet(expandAll()), []),
    collapseAll: useCallback(() => setSet(all), [all]),
    allExpanded: collapsed.size === 0,
  };
}
