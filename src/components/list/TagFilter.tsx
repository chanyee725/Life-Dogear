import { ChipCount, ChipLink, cn } from "@/components/ui";
import { buildHref, type QueryParams } from "./query";

export type FilterOption = { value: string; label: string; count?: number };

/**
 * Row of link chips that sets one query param (`?<param>=value`), keeping other params.
 * Server-compatible: pass the page's `searchParams` as `params`.
 */
export function FilterChips({
  options,
  selected,
  param,
  basePath,
  params = {},
  allLabel = "전체",
  ariaLabel,
  className,
}: {
  options: readonly FilterOption[];
  selected?: string;
  param: string;
  basePath: string;
  params?: QueryParams;
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ChipLink href={buildHref(basePath, params, { [param]: undefined })} active={!selected}>
        {allLabel}
      </ChipLink>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <ChipLink
            key={o.value}
            href={buildHref(basePath, params, { [param]: active ? undefined : o.value })}
            active={active}
          >
            {o.label}
            {o.count !== undefined ? <ChipCount>{o.count}</ChipCount> : null}
          </ChipLink>
        );
      })}
    </nav>
  );
}

/** Tag filter (`?tag=<name>`). Clicking the active tag clears it. */
export function TagFilter({
  tags,
  selected,
  basePath,
  params,
  className,
}: {
  tags: readonly { name: string; count?: number }[];
  selected?: string;
  basePath: string;
  params?: QueryParams;
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <FilterChips
      ariaLabel="태그 필터"
      param="tag"
      basePath={basePath}
      params={params}
      selected={selected}
      allLabel="모든 태그"
      options={tags.map((t) => ({ value: t.name, label: `#${t.name}`, count: t.count }))}
      className={className}
    />
  );
}
