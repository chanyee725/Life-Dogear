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
