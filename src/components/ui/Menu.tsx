"use client";

import { useRef, type ComponentProps, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/primitives/dropdown-menu";
import { cn } from "./cn";

/** Open motion (no tw-animate-css here; the primitives' animate-* classes are inert). */
export const openMotion =
  "transition-[opacity,scale] duration-100 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none";

export type MenuAction = { label: string; run: () => void; danger?: boolean };

export { DropdownMenu as Menu, DropdownMenuTrigger as MenuTrigger };

/** Menu panel: shadcn DropdownMenuContent with the app's popover colours. */
export function MenuContent({ className, ...props }: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      className={cn("flex min-w-36 flex-col border-border", openMotion, className)}
      {...props}
    />
  );
}

/** One row; `danger` for destructive actions. Focus uses `bg-hover` (`bg-accent` is the brand colour here). */
export function MenuItem({
  danger = false,
  className,
  ...props
}: Omit<ComponentProps<typeof DropdownMenuItem>, "variant"> & { danger?: boolean }) {
  return (
    <DropdownMenuItem
      variant={danger ? "destructive" : "default"}
      className={cn(
        "h-8 py-0",
        danger ? "text-destructive" : "text-fg focus:bg-hover focus:text-fg",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Always-open menu pinned to an existing element (no trigger of its own), e.g. opened from a
 * calendar chip by keyboard or long press. Unmount it to close. `onClose(refocus)` fires on
 * Esc (`true`) or an outside press (`false`); picking an item only runs the item.
 */
export function AnchoredMenu({
  anchor,
  label,
  items,
  onClose,
  align = "start",
}: {
  anchor: HTMLElement;
  label: string;
  items: readonly MenuAction[];
  onClose: (refocus: boolean) => void;
  align?: "start" | "end";
}): ReactNode {
  const r = anchor.getBoundingClientRect();
  const picked = useRef(false);
  const escaped = useRef(false);
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open && !picked.current) onClose(escaped.current);
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed"
          style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
        />
      </DropdownMenuTrigger>
      <MenuContent
        align={align}
        aria-label={label}
        onEscapeKeyDown={() => {
          escaped.current = true;
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {items.map((item) => (
          <MenuItem
            key={item.label}
            danger={item.danger}
            onSelect={() => {
              picked.current = true;
              item.run();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </DropdownMenu>
  );
}
