/**
 * Drag-and-drop ordering math for task lists (pure, so it can be tested without a DOM).
 * Only open tasks are dragged, and only among open tasks of the same list.
 */

/**
 * Where a dragged row lands: the number of the other rows whose vertical middle is above
 * the pointer (0 = before all of them). `mids` are in list order.
 */
export function dropSlot(mids: readonly number[], y: number): number {
  let slot = 0;
  for (const mid of mids) if (y > mid) slot++;
  return slot;
}

/**
 * Pointer position during a drag, from geometry taken at the press in *list* coordinates
 * (px from the list's top), so scrolling while dragging — which moves the list under a
 * still pointer — keeps the row offset and the drop slot right.
 */
export function dragPosition(
  start: { startY: number; mids: readonly number[] },
  clientY: number,
  listTop: number,
): { dy: number; slot: number } {
  const y = clientY - listTop;
  return { dy: y - start.startY, slot: dropSlot(start.mids, y) };
}

/**
 * The new order after dropping `id` at `slot` among the others, and its neighbours there:
 * the task it now follows (null = first) and the one it now precedes (null = last). Null
 * when the order would not change.
 */
export function applyDrop(
  ids: readonly string[],
  id: string,
  slot: number,
): { order: string[]; afterId: string | null; beforeId: string | null } | null {
  const from = ids.indexOf(id);
  if (from < 0) return null;
  const others = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(slot, others.length));
  if (at === from) return null;
  const order = [...others.slice(0, at), id, ...others.slice(at)];
  return { order, afterId: at === 0 ? null : others[at - 1]!, beforeId: others[at] ?? null };
}

/**
 * Server side of a drop, against the order as it is *now* (`current`, same-state siblings;
 * another device may have changed it since the client loaded): the task to follow
 * (null = first), or undefined when neither neighbour can place it any more.
 * Follows `afterId` if it is still there; if it is gone, goes right before `beforeId`.
 * A drop to the top or bottom stays at the top or bottom.
 */
export function resolveAnchor(
  current: readonly string[],
  id: string,
  afterId: string | null,
  beforeId: string | null,
): string | null | undefined {
  const others = current.filter((x) => x !== id);
  if (afterId === null) return null;
  if (others.includes(afterId)) return afterId;
  if (beforeId === null) return others.at(-1) ?? null;
  const k = others.indexOf(beforeId);
  if (k < 0) return undefined;
  return k === 0 ? null : others[k - 1]!;
}

/**
 * `list` with the members (`order`'s ids) placed in `order`, each into a slot a member
 * held before; everything else keeps its place.
 */
export function placeInOrder<T extends { id: string }>(
  list: readonly T[],
  order: readonly string[],
): T[] {
  const members = new Set(order);
  const byId = new Map(list.map((t) => [t.id, t]));
  let n = 0;
  return list.map((t) => (members.has(t.id) ? byId.get(order[n++]!)! : t));
}
