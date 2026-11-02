import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/** Labelled region (`<section aria-labelledby>`) so each block is a named landmark. */
export function DashboardSection({
  id,
  title,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-[13px] font-semibold text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Quiet single-line empty message for dashboard blocks. */
export function DashboardEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
      {children}
    </p>
  );
}
