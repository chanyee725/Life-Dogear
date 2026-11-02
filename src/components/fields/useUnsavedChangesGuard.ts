"use client";

import { useEffect } from "react";
import {
  confirmLeave,
  isInAppNavigation,
  registerGuard,
  UNSAVED_CHANGES_MESSAGE,
  unregisterGuard,
} from "./unsaved-guard";

/**
 * While `dirty`, asks before losing edits:
 * - reload, tab close, typed URL → the browser's leave-page warning (beforeunload)
 * - clicks on in-app links (Next `<Link>` included) → confirm(); cancel keeps the page
 * - programmatic navigation should call `confirmLeave()` first (the shortcuts do)
 * Browser back/forward (popstate) is not intercepted.
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  message: string = UNSAVED_CHANGES_MESSAGE,
): void {
  useEffect(() => {
    if (!dirty) return;
    const guard = registerGuard(message);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Already agreed to leave (link or shortcut): don't ask again while unmounting.
      if (guard.leaving) return;
      event.preventDefault();
      event.returnValue = ""; // Older browsers need returnValue set.
    };

    // Capture phase on document runs before React's root listener and Next's Link handler.
    const onClick = (event: MouseEvent) => {
      // HTML anchors only: SVG <a> elements (SVGAElement) are not guarded; the app has none.
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const navigates = isInAppNavigation(
        event,
        { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute("download") },
        new URL(window.location.href),
      );
      if (!navigates || confirmLeave()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      unregisterGuard(guard);
    };
  }, [dirty, message]);
}
