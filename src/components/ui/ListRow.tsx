import type { HTMLAttributes, LiHTMLAttributes } from "react";
import { cn } from "./cn";

/** Bordered list with thin dividers between rows (`<ul>`). */
export function RowList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        "flex flex-col divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * One dense row inside a `RowList`. The first/last rows take the list's corner radius
 * so a caller's hover background does not poke past the rounded border.
 */
export function ListRow({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 first:rounded-t-[inherit] last:rounded-b-[inherit]",
        className,
      )}
      {...props}
    />
  );
}
