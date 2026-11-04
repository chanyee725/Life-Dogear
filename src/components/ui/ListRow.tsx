import type { HTMLAttributes, LiHTMLAttributes } from "react";
import { cn } from "./cn";

/** Bordered list with thin dividers between rows (`<ul>`). */
export function RowList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        "flex flex-col divide-y divide-border rounded-lg border border-border",
        className,
      )}
      {...props}
    />
  );
}

/** One dense row inside a `RowList`. */
export function ListRow({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("flex items-center gap-2.5 px-3 py-2", className)} {...props} />;
}
