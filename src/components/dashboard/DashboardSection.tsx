import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, cn } from "@/components/ui";

/** Labelled region (`<section aria-labelledby>`) so each block is a named landmark. */
export function DashboardSection({
  id,
  title,
  titleExtra,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  /** Shown after the title inside the heading (e.g. a count). */
  titleExtra?: ReactNode;
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
          {titleExtra}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The only body of an empty dashboard block: one add button, no explanation. */
/** Empty section: a dashed box holding only the add action (no explanatory copy). */
export function DashboardAdd({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border px-4 py-5">
      <Link href={href} className={buttonClass("ghost", "sm")}>
        {children}
      </Link>
    </div>
  );
}
