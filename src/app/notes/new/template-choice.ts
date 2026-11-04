/** Pure rules for the template picker on /notes/new. */

/**
 * A new template replaces the body only when the user has not written anything of their
 * own: the body is empty, or still exactly what the current template put there (as the
 * editor serialised it).
 */
export function canReplaceBody(current: string, templateBaseline: string | null): boolean {
  return current.trim() === "" || (templateBaseline !== null && current === templateBaseline);
}

/** Arrow keys move through the radio cards, wrapping at both ends; other keys do nothing. */
export function nextIndex(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
