import Link from "next/link";
import { cn } from "./cn";
import { segItem, segTrack } from "./segmented-style";

/** Underlined link tabs (each tab is a URL, e.g. `?kind=general`). */
export function LinkTabs({
  tabs,
  active,
  ariaLabel,
  className,
}: {
  tabs: readonly {
    value: string;
    label: string;
    href: string;
    count?: number;
    /** Class for the count only (e.g. `text-tone-red-fg` for overdue); default muted. */
    countClassName?: string;
  }[];
  active: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cn("flex gap-4 border-b border-border", className)}>
      {tabs.map((tab) => {
        const current = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px flex h-9 items-center gap-1.5 border-b-2 px-0.5 text-sm transition-colors",
              current
                ? "border-fg font-medium text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn("text-xs tabular-nums", tab.countClassName ?? "text-muted")}>
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Segmented control whose options are URLs (`[목록 | 달력]`, `[월 | 주]`). */
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
    <nav aria-label={ariaLabel} className={cn(segTrack, className)}>
      {options.map((o) => {
        const current = o.value === active;
        return (
          <Link
            key={o.value}
            href={o.href}
            aria-current={current ? "page" : undefined}
            className={segItem(current)}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
