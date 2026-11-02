/** "다음: …" line for a project's next action; nothing when empty. */
export function NextAction({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const text = value?.trim();
  if (!text) return null;
  return (
    <span className={`line-clamp-2 text-xs text-muted ${className ?? ""}`}>
      <span className="font-medium text-fg/80">다음</span> · {text}
    </span>
  );
}
