import { cn } from "./cn";

export function Spinner({
  className,
  label = "불러오는 중",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted",
        className,
      )}
    />
  );
}
