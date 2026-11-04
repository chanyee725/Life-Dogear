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

/** Section block with a small heading and optional right-side action. */
export function Section({
  title,
  action,
  className,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
