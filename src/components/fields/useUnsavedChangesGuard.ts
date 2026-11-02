"use client";

import { useEffect } from "react";
import { isInAppNavigation, UNSAVED_CHANGES_MESSAGE } from "./unsaved-guard";

/**
 * While `dirty`, asks before losing edits:
 * - reload, tab close, typed URL → the browser's leave-page warning (beforeunload)
 * - clicks on in-app links (Next `<Link>` included) → confirm(); cancel keeps the page
 * Browser back/forward (popstate) is not intercepted.
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  message: string = UNSAVED_CHANGES_MESSAGE,
): void {
  useEffect(() => {
    if (!dirty) return;
    // Set once the user agreed to leave via a link, so the unload warning doesn't ask
    // again while the client navigation is still unmounting this page.
    let leaving = false;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving) return;
      event.preventDefault();
      event.returnValue = ""; // Older browsers need returnValue set.
    };

    // Capture phase on document runs before React's root listener and Next's Link handler.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const navigates = isInAppNavigation(
        event,
        { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute("download") },
        new URL(window.location.href),
      );
      if (!navigates) return;
      if (window.confirm(message)) {
        leaving = true;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
