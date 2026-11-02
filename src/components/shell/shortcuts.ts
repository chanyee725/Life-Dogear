export const QUICK_INPUT_ID = "quick-input";

const SECTIONS = ["projects", "areas", "papers", "seminars", "thoughts"] as const;
/** Where `N` goes outside the item sections (home, inbox, tags, archive). */
const DEFAULT_NEW_SECTION = "thoughts";

export type ShortcutAction =
  { kind: "navigate"; href: string } | { kind: "focus-quick-input" } | null;

export type ShortcutKeyEvent = {
  key: string;
  /** Physical key; lets `N` work while a Korean input mode turns `key` into "ㅜ". */
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

export type ShortcutContext = {
  /** Focus is in a text field, select or the editor. */
  typing: boolean;
  /** A modal dialog is open. */
  dialogOpen?: boolean;
};

/** Pure decision for the global single-key shortcuts. */
export function resolveShortcut(
  event: ShortcutKeyEvent,
  pathname: string,
  context: ShortcutContext,
): ShortcutAction {
  if (context.typing || context.dialogOpen) return null;
  // keyCode 229: the IME is still processing the key.
  if (event.isComposing || event.keyCode === 229) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;

  const isN = event.key === "n" || event.key === "N" || event.code === "KeyN";
  const isSlash = event.key === "/" || (event.code === "Slash" && !event.shiftKey);

  if (isN) {
    const segment = pathname.split("/")[1] ?? "";
    const section = (SECTIONS as readonly string[]).includes(segment)
      ? segment
      : DEFAULT_NEW_SECTION;
    const href = `/${section}/new`;
    return pathname === href ? null : { kind: "navigate", href };
  }

  if (isSlash) return { kind: "focus-quick-input" };

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
