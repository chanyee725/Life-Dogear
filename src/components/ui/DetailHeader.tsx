import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Detail page top row: `← 뒤로` link, then save status and quiet actions
 * (`QuietButton`: 보관, 삭제, 저장) on the right.
 */
export function DetailHeader({
  backHref,
  backLabel,
  status,
  actions,
  className,
}: {
  backHref: string;
  backLabel: string;
  /** Usually `<SaveStatus/>`. */
  status?: ReactNode;
  /** Quiet buttons (보관, 삭제, 저장). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}>
      <BackLink href={backHref}>{backLabel}</BackLink>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
        {status ? <div className="mr-2 whitespace-nowrap">{status}</div> : null}
        {actions}
      </div>
    </div>
  );
}

/** Quiet `← label` link back to a parent page. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("shrink-0 text-[13px] whitespace-nowrap text-muted hover:text-fg", className)}
    >
      ← {children}
    </Link>
  );
}
