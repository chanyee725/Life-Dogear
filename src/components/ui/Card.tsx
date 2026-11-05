import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** shadcn card surface: larger radius than controls, hairline border, faint lift. */
export const cardClass =
  "block rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm";

/** Extra classes for a card that is a link: quiet hover, border darkens. */
export const cardLinkClass =
  "transition-[color,background-color,border-color,box-shadow] hover:border-border-strong hover:bg-surface";

/** Bordered container. With `href` the whole card becomes a link with a hover state. */
export function Card({
  href,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { href?: string; children?: ReactNode }) {
  if (href) {
    return (
      <Link href={href} className={cn(cardClass, cardLinkClass, className)}>
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

/**
 * Section heading (`h2`, or `as="h3"`): 14px semibold foreground, optional faint `count`
 * beside it, optional right-side action.
 */
export function SectionHeader({
  title,
  count,
  action,
  id,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  count?: ReactNode;
  action?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-6 items-center justify-between gap-2", className)}>
      <Heading
        id={id}
        className="flex items-baseline gap-1.5 text-sm font-semibold tracking-tight text-foreground"
      >
        {title}
        {count !== undefined && count !== null ? (
          <span className="text-[13px] font-normal tabular-nums text-faint">{count}</span>
        ) : null}
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
  count,
  action,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  count?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)}>
      <SectionHeader id={headingId} title={title} count={count} action={action} />
      {children}
    </section>
  );
}
