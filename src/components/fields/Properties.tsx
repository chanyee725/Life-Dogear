import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Label/value rows for item properties (Notion-like). */
export function Properties({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Property({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-[13px] text-muted">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}
