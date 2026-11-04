import { cn } from "@/components/ui/cn";

/**
 * Thin progress bar with the number; nothing for null (life goals, nothing measured).
 * `barClassName` sets the bar width (default `w-16`); `valueClassName` styles the number.
 */
export function GoalProgress({
  value,
  className,
  barClassName,
  valueClassName,
}: {
  value: number | null;
  className?: string;
  barClassName?: string;
  valueClassName?: string;
}) {
  if (value === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        role="progressbar"
        aria-label="진행률"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn("h-1.5 w-16 overflow-hidden rounded-full bg-tone-gray-bg", barClassName)}
      >
        <span className="block h-full rounded-full bg-tone-red-fg" style={{ width: `${value}%` }} />
      </span>
      <span className={cn("text-xs text-muted tabular-nums", valueClassName)}>{value}%</span>
    </span>
  );
}
