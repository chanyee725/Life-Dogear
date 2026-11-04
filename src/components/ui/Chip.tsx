import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** Chip look for filters and sort links; selected = accent text on a soft accent, thin border. */
export const chipClass = (active: boolean, className?: string): string =>
  cn(
    "inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[13px] transition-colors",
    active
      ? "border-accent/30 bg-accent-soft font-medium text-accent"
      : "border-transparent text-muted hover:bg-subtle hover:text-fg",
    className,
  );

/** Link chip; `active` marks it with `aria-current="true"`. */
export function ChipLink({
  active = false,
  className,
  ...props
}: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={chipClass(active, className)}
      {...props}
    />
  );
}

/** Quiet count after a chip or tab label. */
export function ChipCount({ children }: { children: ReactNode }) {
  return <span className="text-xs font-normal text-muted tabular-nums">{children}</span>;
}
