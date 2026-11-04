"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

const GAP = 4;
const MARGIN = 8;

/**
 * Popover pinned to `anchor` with `position: fixed` (the grid clips with `overflow-hidden`).
 * Flips above when there is no room below. `Esc` and outside presses close it; the caller
 * puts focus back.
 */
export function Popover({
  anchor,
  onClose,
  label,
  role = "dialog",
  className,
  children,
}: {
  anchor: HTMLElement | null;
  /** `refocus`: closed with Esc (focus should go back to the opener). */
  onClose: (refocus: boolean) => void;
  label: string;
  role?: "dialog" | "menu";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect();
      const { width, height } = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = a.bottom + GAP;
      const top =
        below + height > vh - MARGIN && a.top - GAP - height > MARGIN
          ? a.top - GAP - height
          : below;
      const left = Math.min(Math.max(MARGIN, a.left), Math.max(MARGIN, vw - width - MARGIN));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  // Move focus inside unless a child already took it (autoFocus input, menu item).
  useEffect(() => {
    const el = ref.current;
    if (!el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLElement>("a[href],button,input,[tabindex]")?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      closeRef.current(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [anchor]);

  return (
    <div
      ref={ref}
      role={role}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeRef.current(true);
        }
      }}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className={cn("fixed z-50 rounded-lg border border-border bg-bg shadow-overlay", className)}
    >
      {children}
    </div>
  );
}
