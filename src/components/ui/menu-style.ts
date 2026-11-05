import { cn } from "./cn";

/** Panel of a `role="menu"` list (shadcn DropdownMenuContent look). */
export const menuPanelClass =
  "rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md";

/** One `role="menuitem"` row (shadcn DropdownMenuItem look); `danger` for destructive actions. */
export function menuItemClass(danger = false, className?: string): string {
  return cn(
    "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm outline-none select-none transition-colors",
    // bg-hover alone is too faint to show keyboard focus; keep a ring for it.
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    danger
      ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
      : "text-foreground hover:bg-hover focus:bg-hover",
    className,
  );
}
