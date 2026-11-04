"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./cn";

export type ToastPlace = "top-right" | "bottom-right";

const PLACE: Record<ToastPlace, string> = {
  "top-right": "top-4 right-4",
  "bottom-right": "right-4 bottom-4",
};

/**
 * A short notice in a screen corner (`role="status"`). Calls `onDone` after `ms`; the timer
 * pauses while hovered or focused. Render one at a time and change its `key` to restart it.
 */
export function Toast({
  ms,
  onDone,
  place = "bottom-right",
  className,
  children,
}: {
  ms: number;
  onDone: () => void;
  place?: ToastPlace;
  className?: string;
  children: ReactNode;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [paused, onDone, ms]);
  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "fixed z-50 rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-fg shadow-overlay",
        PLACE[place],
        className,
      )}
    >
      {children}
    </div>
  );
}
