"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { isTypingTarget, QUICK_INPUT_ID, resolveShortcut } from "./shortcuts";

function focusQuickInput(): boolean {
  const el = document.getElementById(QUICK_INPUT_ID);
  if (!el) return false;
  el.focus();
  return true;
}

/**
 * Global keyboard shortcuts (mounted once in the root layout):
 * - `N`  → new item in the current section (`/<type>/new`; home and tags go to a new thought)
 * - `/`  → focus the home quick input (`#quick-input`), navigating home first if needed
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
        router.push(action.href);
      } else if (!focusQuickInput()) {
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
