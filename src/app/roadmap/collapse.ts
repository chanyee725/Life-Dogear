// Which stages and item branches are folded. Ids of stages and items share one set; both
// are opaque strings from the import, unique within a roadmap.

export type CollapsedSet = ReadonlySet<string>;

export function toggleCollapsed(set: CollapsedSet, id: string): CollapsedSet {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Folded set after "모두 접기": every stage folded. */
export function collapseAll(stageIds: string[]): CollapsedSet {
  return new Set(stageIds);
}

export const expandAll = (): CollapsedSet => new Set();
