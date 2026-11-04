import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const cardClass = "block rounded-lg border border-border bg-bg p-4";

/** Bordered container. With `href` the whole card becomes a link with a hover state. */
export function Card({
  href,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { href?: string; children?: ReactNode }) {
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          cardClass,
          "transition-colors hover:border-border-strong hover:bg-surface",
          className,
        )}
      >
        {children}
      </Link>
    );
  }
  return (
    <div className={cn(cardClass, className)} {...props}>
      {children}
    </div>
  );
}

/** Small muted section heading (`h2`, or `as="h3"`) with an optional right-side action. */
export function SectionHeader({
  title,
  action,
  id,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <Heading id={id} className="text-[13px] font-semibold text-muted">
        {title}
      </Heading>
      {action}
    </div>
  );
}

/**
 * Section block with a `SectionHeader`. With `id` the section is a named landmark
 * (`aria-labelledby` → `<id>-heading`).
 */
export function Section({
  id,
  title,
  action,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)}>
      <SectionHeader id={headingId} title={title} action={action} />
      {children}
    </section>
  );
}
