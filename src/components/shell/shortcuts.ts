export const QUICK_INPUT_ID = "quick-input";

const SECTIONS = ["projects", "papers", "seminars", "thoughts"] as const;
/** Where `N` goes when the current page is not one of the four item sections (home, tags). */
const DEFAULT_NEW_SECTION = "thoughts";

export type ShortcutAction =
  { kind: "navigate"; href: string } | { kind: "focus-quick-input" } | null;

export type ShortcutKeyEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
};

/** Pure decision for the global single-key shortcuts. */
export function resolveShortcut(
  event: ShortcutKeyEvent,
  pathname: string,
  typing: boolean,
): ShortcutAction {
  if (typing || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return null;

  if (event.key === "n" || event.key === "N") {
    const segment = pathname.split("/")[1] ?? "";
    const section = (SECTIONS as readonly string[]).includes(segment)
      ? segment
      : DEFAULT_NEW_SECTION;
    const href = `/${section}/new`;
    return pathname === href ? null : { kind: "navigate", href };
  }

  if (event.key === "/") return { kind: "focus-quick-input" };

  return null;
}

/** True when keystrokes belong to a text field, select or rich-text editor. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(
      type,
    );
  }
  return false;
}
