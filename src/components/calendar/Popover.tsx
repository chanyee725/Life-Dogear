"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Popover as PopoverRoot, PopoverAnchor } from "@/components/ui/primitives/popover";

const GAP = 4;
const MARGIN = 8;

/**
 * Radix popover pinned to `anchor` (a virtual anchor: callers keep their own opener).
 * Radix places it (flips above when there is no room below). `Esc` and outside presses close it; the
 * caller puts focus back. `hidden` keeps it mounted but closed (its fields keep their
 * state); showing it again moves focus inside.
 *
 * `Esc` is handled on the content (not Radix's document listener) so a field inside can
 * claim it first with `stopPropagation` (a title edit cancels without closing), and a
 * kept-mounted hidden popover never swallows another popover's `Esc`.
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
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const virtualRef = useMemo(() => ({ current: anchor }), [anchor]);

  // Move focus inside unless a child already took it (autoFocus input, menu item).
  useEffect(() => {
    const el = ref.current;
    if (hidden || !el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLElement>("a[href],button,input,[tabindex]")?.focus();
  }, [hidden]);

  return (
    <PopoverRoot open={!hidden}>
      {anchor ? <PopoverAnchor virtualRef={virtualRef as { current: HTMLElement }} /> : null}
      {/* Content without the primitive's Portal: PopoverPortal unmounts when closed, which
          would drop `hidden`'s kept state. Radix places it `position: fixed`, so the grid's
          `overflow-hidden` still does not clip it. */}
      <PopoverPrimitive.Content
        ref={ref}
        forceMount
        id={id}
        hidden={hidden}
        role={role}
        aria-label={label}
        side="bottom"
        align={align}
        sideOffset={GAP}
        collisionPadding={MARGIN}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          if (hiddenRef.current) return;
          const t = e.target as Node | null;
          if (t && anchor?.contains(t)) return;
          closeRef.current(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeRef.current(true);
          }
        }}
        className={cn(
          "z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none",
          "origin-(--radix-popover-content-transform-origin) transition-[opacity,scale] duration-100 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none",
          className,
        )}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverRoot>
  );
}
