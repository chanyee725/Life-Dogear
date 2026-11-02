export const UNSAVED_CHANGES_MESSAGE = "저장하지 않은 변경이 있습니다. 이 페이지를 떠날까요?";

export type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

export type AnchorLike = {
  href: string;
  target: string;
  hasDownload: boolean;
};

/**
 * True when a click on this anchor would navigate the current tab to another page of
 * this app (the case to confirm). Modified clicks, new tabs, downloads, other origins
 * and same-page hash links are left alone.
 */
export function isInAppNavigation(click: ClickLike, anchor: AnchorLike, current: URL): boolean {
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (anchor.hasDownload) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  let next: URL;
  try {
    next = new URL(anchor.href, current);
  } catch {
    return false;
  }
  if (next.origin !== current.origin) return false;
  const samePage = next.pathname === current.pathname && next.search === current.search;
  return !samePage;
}

/** How long a "yes, leave" answer suppresses further prompts if the navigation never completes. */
const LEAVING_RESET_MS = 2_000;

type ActiveGuard = {
  message: string;
  leaving: boolean;
  resetTimer?: ReturnType<typeof setTimeout>;
};

/** Guards registered by mounted `useUnsavedChangesGuard` hooks with unsaved edits. */
const activeGuards = new Set<ActiveGuard>();

export function registerGuard(message: string): ActiveGuard {
  const guard: ActiveGuard = { message, leaving: false };
  activeGuards.add(guard);
  return guard;
}

export function unregisterGuard(guard: ActiveGuard): void {
  clearTimeout(guard.resetTimer);
  activeGuards.delete(guard);
}

/**
 * Call before any programmatic navigation (e.g. keyboard shortcuts). With unsaved edits
 * it asks once; returns false if the user wants to stay. After "yes", the guards stay
 * quiet briefly so the unload/link checks don't ask again while the page changes.
 */
export function confirmLeave(): boolean {
  const pending = [...activeGuards].filter((g) => !g.leaving);
  if (pending.length === 0) return true;
  if (!window.confirm(pending[0].message)) return false;
  for (const guard of activeGuards) {
    guard.leaving = true;
    clearTimeout(guard.resetTimer);
    guard.resetTimer = setTimeout(() => {
      guard.leaving = false;
    }, LEAVING_RESET_MS);
  }
  return true;
}
