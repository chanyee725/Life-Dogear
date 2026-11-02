import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Standard page width + padding. Pages that need full width (e.g. the PDF viewer) can skip it. */
export function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-10 py-10", className)}>{children}</div>;
}

/** Page title row with optional eyebrow (e.g. back link), description and right-side actions. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-col gap-1", className)}>
      {eyebrow ? <div className="text-[13px] text-muted">{eyebrow}</div> : null}
      <div className="flex items-start justify-between gap-4">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{title}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
    </header>
  );
}
