"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Popover as PopoverRoot, PopoverAnchor } from "@/components/ui/primitives/popover";

const GAP = 4;
const MARGIN = 8;

/**
 * Radix popover pinned to `anchor` (a virtual anchor: callers keep their own opener).
 * Radix places it (flips above when there is no room below). `Esc` and outside presses
 * close it; the caller puts focus back. `hidden` closes it but keeps the children mounted
 * (fields and counts keep their state) with no Radix content mounted, so nothing of it
 * listens to the document; showing it again moves focus inside.
 *
 * `Esc` is handled through React bubbling (not Radix's document listener) so a field
 * inside can claim it first with `stopPropagation` (a title edit cancels without closing).
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
  // The children render into this one node for the popover's whole life (a React portal),
  // so their state survives `hidden`. Open, it sits inside the Radix content; hidden, in a
  // plain hidden box, so no Radix layer stays mounted to catch document `Esc`/presses.
  // `display: contents` lets the caller's layout classes on the content reach the children.
  const [box] = useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.style.display = "contents";
    return el;
  });
  // Radix decides "outside" on click, when the pressed node may already be gone (a title
  // that turned into a field), so remember presses that started inside the box.
  const pressedInside = useRef<PointerEvent | null>(null);
  useEffect(() => {
    if (!box) return;
    const onDown = (e: PointerEvent) => (pressedInside.current = e);
    box.addEventListener("pointerdown", onDown, true);
    return () => box.removeEventListener("pointerdown", onDown, true);
  }, [box]);
  const holdBox = (el: HTMLElement | null) => {
    if (el && box && box.parentNode !== el) el.appendChild(box);
  };

  // Move focus inside unless a child already took it (autoFocus input, menu item).
  useEffect(() => {
    const el = ref.current;
    if (hidden || !el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLElement>("a[href],button,input,[tabindex]")?.focus();
  }, [hidden]);

  return (
    // React events from the portal bubble here (not through the Radix content): `Esc` from
    // inside closes it, after any field inside had the chance to `stopPropagation`.
    <div
      className="contents"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || hiddenRef.current) return;
        if (!ref.current?.contains(e.target as Node)) return; // e.g. a nested menu's own Esc
        e.preventDefault();
        e.stopPropagation();
        closeRef.current(true);
      }}
    >
      {box ? createPortal(children, box) : null}
      {hidden ? (
        <div ref={holdBox} id={id} role={role} aria-label={label} hidden />
      ) : (
        <PopoverRoot open>
          {anchor ? <PopoverAnchor virtualRef={virtualRef as { current: HTMLElement }} /> : null}
          {/* Content without the primitive's Portal: Radix places it `position: fixed`, so
              the grid's `overflow-hidden` still does not clip it. */}
          <PopoverPrimitive.Content
            ref={(el) => {
              ref.current = el;
              holdBox(el);
            }}
            id={id}
            role={role}
            aria-label={label}
            side="bottom"
            align={align}
            sideOffset={GAP}
            collisionPadding={MARGIN}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            // Esc is handled on the wrapper above, so a field inside can claim it first.
            onEscapeKeyDown={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              e.preventDefault();
              if (e.detail.originalEvent === pressedInside.current) return;
              const t = e.target as Node | null;
              if (t && (ref.current?.contains(t) || anchor?.contains(t))) return;
              closeRef.current(false);
            }}
            className={cn(
              "z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none",
              "origin-(--radix-popover-content-transform-origin) transition-[opacity,scale] duration-100 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none",
              className,
            )}
          />
        </PopoverRoot>
      )}
    </div>
  );
}
