/** Task order rules shared by the server action and the repo (pure). */

/** Shown when a drop can no longer be placed because the list changed elsewhere. */
export const LIST_CHANGED = "할 일 목록이 바뀌었습니다. 다시 불러왔으니 한 번 더 옮겨 주세요.";

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
