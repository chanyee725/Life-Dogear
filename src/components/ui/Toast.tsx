"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "./cn";
import { Toaster } from "./primitives/sonner";

export type ToastPlace = "top-right" | "bottom-right";

/**
 * The one sonner viewport, mounted once in the root layout. From md the detail header's
 * buttons sit in the top corner, so top-right toasts drop below them (`offset.top`).
 */
export function AppToaster() {
  return (
    <Toaster
      offset={{ top: 80, right: 16, bottom: 16 }}
      mobileOffset={{ top: 16, right: 16, bottom: 16, left: 16 }}
      gap={8}
    />
  );
}

/**
 * A short notice in a screen corner (`role="status"`), shown through sonner (needs
 * `<AppToaster />` mounted). Calls `onDone` after `ms`; the timer pauses while hovered or
 * focused. Render one at a time and change its `key` to restart it.
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
  const id = useId();
  const [paused, setPaused] = useState(false);

  // Our own timer (not sonner's): sonner pauses on hover only, and we also pause on focus.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [paused, onDone, ms]);

  useEffect(() => {
    toast.custom(
      () => (
        <div
          role="status"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className={cn(
            "ml-auto w-fit max-w-full rounded-md border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg",
            className,
          )}
        >
          {children}
        </div>
      ),
      { id, duration: Infinity, position: place, dismissible: false },
    );
  });

  // Unmounting (onDone, or a new `key`) removes it from the viewport.
  useEffect(() => () => void toast.dismiss(id), [id]);

  return null;
}
