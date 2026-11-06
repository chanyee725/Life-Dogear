import { TagChip } from "@/components/ui/Badge";

/** Inline tag chips for table cells and cards. */
export function TagList({ tags, max = 3 }: { tags: readonly string[]; max?: number }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  return (
    <span className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
      {shown.map((t) => (
        <TagChip key={t}>#{t}</TagChip>
      ))}
      {tags.length > max ? <span className="shrink-0 text-xs text-muted tabular-nums">+{tags.length - max}</span> : null}
    </span>
  );
}
