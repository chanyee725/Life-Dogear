import Link from "next/link";
import { cn } from "@/components/ui/cn";

/** Small segmented control whose options are URLs (`[목록 | 달력]`, `[월 | 주]`). */
export function SegmentedLinks({
  options,
  active,
  ariaLabel,
  className,
}: {
  options: readonly { value: string; label: string; href: string }[];
  active: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex h-7 gap-0.5 rounded-lg bg-subtle p-0.5", className)}
    >
      {options.map((o) => {
        const current = o.value === active;
        return (
          <Link
            key={o.value}
            href={o.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-6 items-center rounded-md px-2.5 text-[13px] transition-colors",
              current ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
