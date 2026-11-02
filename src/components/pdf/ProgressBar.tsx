type ProgressBarProps = {
  /** Current page (1-based). */
  current: number | null | undefined;
  total: number | null | undefined;
  /** Show "3 / 10쪽" next to the bar. */
  showLabel?: boolean;
  className?: string;
};

/** Reading progress bar: current page over total pages. */
export function ProgressBar({
  current,
  total,
  showLabel = true,
  className = "",
}: ProgressBarProps) {
  const known = !!total && total > 0;
  const page = known ? Math.min(Math.max(current ?? 0, 0), total) : 0;
  const percent = known ? Math.round((page / total) * 100) : 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="progressbar"
        aria-label="읽기 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={known ? `${total}쪽 중 ${page}쪽` : "전체 쪽수 모름"}
        className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      >
        <div
          className="h-full rounded-full bg-neutral-700 transition-[width] dark:bg-neutral-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="shrink-0 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
          {known ? `${page} / ${total}쪽` : current ? `${current}쪽` : "—"}
        </span>
      )}
    </div>
  );
}
