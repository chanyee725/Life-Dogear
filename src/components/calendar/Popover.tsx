"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

const GAP = 4;
const MARGIN = 8;

/**
 * Popover pinned to `anchor` with `position: fixed` (the grid clips with `overflow-hidden`).
 * Flips above when there is no room below. `Esc` and outside presses close it; the caller
 * puts focus back. `hidden` keeps it mounted but closed (its fields keep their state);
 * showing it again re-places it and moves focus inside.
 */
export function Popover({
  anchor,
  onClose,
  label,
  role = "dialog",
  id,
  align = "start",
  hidden = false,
  className,
  children,
}: {
  anchor: HTMLElement | null;
  /** For the opener's `aria-controls`. */
  id?: string;
  /** Which edges line up: the left edges (`start`) or the right edges (`end`). */
  align?: "start" | "end";
  hidden?: boolean;
  /** `refocus`: closed with Esc (focus should go back to the opener). */
  onClose: (refocus: boolean) => void;
  label: string;
  role?: "dialog" | "menu";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (hidden) return;
    const place = () => {
      const el = ref.current;
      if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect();
      // Layout size, not getBoundingClientRect: the entry `scale-95` would shrink it.
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = a.bottom + GAP;
      const above = below + height > vh - MARGIN && a.top - GAP - height > MARGIN;
      const top = above ? a.top - GAP - height : below;
      const want = align === "end" ? a.right - width : a.left;
      const left = Math.min(Math.max(MARGIN, want), Math.max(MARGIN, vw - width - MARGIN));
      setPos({ top, left, above });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, hidden, align]);

  // Move focus inside unless a child already took it (autoFocus input, menu item).
  useEffect(() => {
    const el = ref.current;
    if (hidden || !el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLElement>("a[href],button,input,[tabindex]")?.focus();
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      closeRef.current(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [anchor, hidden]);

  return (
    <div
      ref={ref}
      id={id}
      hidden={hidden}
      role={role}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeRef.current(true);
        }
      }}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Grow from the anchored corner so the aligned edge does not move while scaling in.
        transformOrigin: `${pos?.above ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`,
      }}
      className={cn(
        "fixed z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none",
        "transition-[opacity,scale] duration-100 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
