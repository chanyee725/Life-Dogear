import { TagChip } from "@/components/ui/Badge";

/** Inline tag chips for table cells and cards. */
export function TagList({ tags, max = 3 }: { tags: readonly string[]; max?: number }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <TagChip key={t}>#{t}</TagChip>
      ))}
      {tags.length > max ? <span className="text-xs text-faint">+{tags.length - max}</span> : null}
    </span>
  );
}
