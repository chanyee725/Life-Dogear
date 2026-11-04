"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { OPEN_CAPTURE_EVENT } from "@/components/capture/capture";
import { confirmLeave } from "@/components/fields/unsaved-guard";
import { GRAPH_SEARCH_EVENT, isTypingTarget, QUICK_ADD_EVENT, resolveShortcut } from "./shortcuts";

/**
 * Asks the home 빠른 추가 to open on 생각 추가 (`#quick-input`). Always the event, never a
 * direct focus: the input stays in the DOM (hidden) after the popover closes.
 */
function focusQuickInput(): boolean {
  const event = new Event(QUICK_ADD_EVENT, { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * Global keyboard shortcuts (mounted once in the root layout):
 * - `N`  → new item in the current section (`/<type>/new`; home and tags go to a new thought)
 * - `G`  → open the graph (`/graph`)
 * - `C`  → quick capture dialog (`OPEN_CAPTURE_EVENT`)
 * - `/`  → open the home 빠른 추가 on 생각 추가 (`#quick-input`), navigating home first if needed;
 *          on the graph page it opens the node search (`GRAPH_SEARCH_EVENT`) instead
 * Ignored while typing (inputs, selects, the editor, IME composition), with modifier keys,
 * and while a modal dialog is open.
 */
export function Shortcuts() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const pendingFocus = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      const action = resolveShortcut(event, pathname, {
        typing: isTypingTarget(event.target),
        dialogOpen: document.querySelector("dialog[open]") !== null,
      });
      if (!action) return;
      event.preventDefault();
      if (action.kind === "navigate") {
        if (confirmLeave()) router.push(action.href);
      } else if (action.kind === "open-capture") {
        window.dispatchEvent(new Event(OPEN_CAPTURE_EVENT));
      } else if (action.kind === "focus-graph-search") {
        window.dispatchEvent(new Event(GRAPH_SEARCH_EVENT));
      } else if (!focusQuickInput()) {
        if (!confirmLeave()) return;
        pendingFocus.current = true;
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  // After navigating home for `/`, focus the quick input once it has rendered.
  useEffect(() => {
    if (!pendingFocus.current || pathname !== "/") return;
    let frames = 0;
    let raf = 0;
    const tryFocus = () => {
      if (focusQuickInput() || ++frames > 60) {
        pendingFocus.current = false;
        return;
      }
      raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
