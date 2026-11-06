"use client";

import { useEffect, useReducer } from "react";

/**
 * Re-renders on every scroll (any scroll container, via capture) or resize while
 * `active`, at most once per frame. Popups that place themselves with
 * `coordsAtPos` + `position: fixed` call this so they stay under the cursor.
 */
export function useFollowScroll(active: boolean) {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        bump();
      });
    };
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [active]);
}
