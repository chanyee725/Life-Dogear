import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Filter/sort row above a list: filters wrap on the left, `end` (e.g. the view toggle)
 * stays at the right edge, aligned with the first row.
 */
export function FilterBar({
  children,
  end,
  className,
}: {
  children: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {end}
    </div>
  );
}
