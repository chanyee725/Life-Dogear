import Link from "next/link";
import { cn } from "@/components/ui/cn";

/** Underlined link tabs (each tab is a URL, e.g. `?kind=general`). */
export function LinkTabs({
  tabs,
  active,
  ariaLabel,
  className,
}: {
  tabs: readonly { value: string; label: string; href: string; count?: number }[];
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
              <span className="text-xs text-muted tabular-nums">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
