/** Pure rules for the template pickers on /notes/new and /projects/new. */

/** Shown under the cards when a choice leaves the user's body alone. */
export const KEPT_BODY_NOTICE = "본문이 있어 템플릿을 적용하지 않았습니다.";

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

export type TemplateChoice<K extends string> = {
  /** Card shown as chosen. */
  selected: K;
  /** Template whose body the editor was last loaded with. */
  applied: K;
  /**
   * Bumped on every replacement and used in the editor key, so re-applying the same
   * template (A → own text → B kept → body cleared → A) still remounts the editor.
   */
  revision: number;
  /** The last choice left the user's body alone. */
  skipped: boolean;
};

export function initialChoice<K extends string>(key: K): TemplateChoice<K> {
  return { selected: key, applied: key, revision: 0, skipped: false };
}

/** Next state after picking `key`; `replace` is `canReplaceBody(...)` for the current body. */
export function chooseTemplate<K extends string>(
  state: TemplateChoice<K>,
  key: K,
  replace: boolean,
): TemplateChoice<K> {
  if (key === state.selected) return state;
  if (!replace) return { ...state, selected: key, skipped: true };
  return { selected: key, applied: key, revision: state.revision + 1, skipped: false };
}
