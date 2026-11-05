"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import { Button, cn, Segmented, Select, type SegmentedOption } from "@/components/ui";
import {
  Popover as PopoverRoot,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/primitives/popover";
import type { GraphColorBy } from "@/lib/graph/color";
import type { GraphFilter, GraphNodeType } from "@/lib/graph/types";
import type { GraphTheme } from "./graph-theme";
import {
  GRAPH_TYPE_LABEL,
  GRAPH_TYPE_ORDER,
  isDefaultFilter,
  OPT_IN_TYPES,
  shownTypes,
} from "./model";
import { DotIcon, ShapeIcon } from "./ShapeIcon";

export type FilterOptions = {
  areas: readonly { id: string; title: string }[];
  tags: readonly string[];
};

const Divider = () => <span aria-hidden className="h-4 w-px shrink-0 bg-border" />;

const selectClass = "h-7 w-auto max-w-44 pl-2 text-[13px]";

/** Conditions kept behind the compact bar's "필터" button (area, topic, archived, orphans). */
export function hiddenFilterCount(filter: GraphFilter): number {
  return [filter.area, filter.tag, filter.archived, filter.orphans].filter(Boolean).length;
}

const COLOR_BY_OPTIONS: readonly SegmentedOption<GraphColorBy>[] = [
  { value: "kind", label: "종류" },
  { value: "area", label: "영역" },
];

/** "색 [종류 | 영역]" segmented control (design 1.3). ←/→ move and select. */
export function ColorByToggle({
  value,
  onChange,
}: {
  value: GraphColorBy;
  onChange: (next: GraphColorBy) => void;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span aria-hidden className="text-[13px] text-muted">
        색
      </span>
      <Segmented ariaLabel="색 기준" options={COLOR_BY_OPTIONS} value={value} onChange={onChange} />
    </span>
  );
}

/**
 * Filter controls (design 6.2): color basis toggle (basic graph only), type chips (also the legend), area and topic selects,
 * archived / orphans checkboxes, reset. `stacked` lays them out vertically (narrow panel).
 * `compact` (medium widths, where one row would wrap): the chips stay in the row and the
 * selects and checkboxes move into a "필터" popover.
 */
export function GraphFilterControls({
  filter,
  onChange,
  options,
  theme,
  colorBy,
  onColorByChange,
  stacked = false,
  compact = false,
}: {
  filter: GraphFilter;
  onChange: (next: GraphFilter) => void;
  options: FilterOptions;
  theme: GraphTheme;
  /**
   * Basic graph: shows the color toggle and chip icons are canvas-matching dots painted by it
   * (1.4 — kind colors, or achromatic `label` when colored by area). Absent (cosmos view):
   * legacy shape icons.
   */
  colorBy?: GraphColorBy;
  onColorByChange?: (next: GraphColorBy) => void;
  stacked?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const types = new Set(shownTypes(filter));

  function toggleType(type: GraphNodeType) {
    const next = new Set(types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange({ ...filter, types: GRAPH_TYPE_ORDER.filter((t) => next.has(t)) });
  }

  const chip = (type: GraphNodeType) => {
    const on = types.has(type);
    return (
      <button
        key={type}
        type="button"
        aria-pressed={on}
        onClick={() => toggleType(type)}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[13px] transition-colors",
          on
            ? "border-border-strong bg-subtle text-fg"
            : "border-border bg-transparent text-muted hover:text-fg",
        )}
      >
        {colorBy ? (
          <DotIcon
            type={type}
            horizon={type === "goal" ? "year" : undefined}
            color={colorBy === "kind" ? theme.kind[type] : theme.label}
            className={on ? "" : "opacity-35"}
          />
        ) : (
          <ShapeIcon
            type={type}
            horizon={type === "goal" ? "year" : undefined}
            theme={theme}
            className={on ? "" : "opacity-35"}
          />
        )}
        {GRAPH_TYPE_LABEL[type]}
      </button>
    );
  };

  const main = GRAPH_TYPE_ORDER.filter((t) => !OPT_IN_TYPES.includes(t));
  const typesSection = (
    <div key="types" role="group" aria-label="종류" className="flex flex-wrap items-center gap-1.5">
      {main.map(chip)}
      <Divider />
      {OPT_IN_TYPES.map(chip)}
      {shownTypes(filter).includes("task") ? (
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-fg">
          <input
            type="checkbox"
            checked={!!filter.doneTasks}
            onChange={(e) => onChange({ ...filter, doneTasks: e.target.checked || undefined })}
          />
          완료 포함
        </label>
      ) : null}
    </div>
  );
  const selectsSection = (
    <div
      key="selects"
      className={cn("flex flex-wrap gap-3", compact ? "flex-col items-start" : "items-center")}
    >
      <span className="inline-flex items-center gap-1.5">
        <label htmlFor={`${id}-area`} className="text-[13px] text-muted">
          영역
        </label>
        <Select
          id={`${id}-area`}
          className={selectClass}
          value={filter.area ?? ""}
          onChange={(e) => onChange({ ...filter, area: e.target.value || undefined })}
        >
          <option value="">전체</option>
          {options.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </Select>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <label htmlFor={`${id}-tag`} className="text-[13px] text-muted">
          주제
        </label>
        <Select
          id={`${id}-tag`}
          className={selectClass}
          value={filter.tag ?? ""}
          onChange={(e) => onChange({ ...filter, tag: e.target.value || undefined })}
        >
          <option value="">전체</option>
          {filter.tag && !options.tags.includes(filter.tag) ? (
            <option value={filter.tag}>{filter.tag}</option>
          ) : null}
          {options.tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </span>
    </div>
  );
  const checksSection = (
    <div
      key="checks"
      className={cn("flex flex-wrap gap-3", compact ? "flex-col items-start" : "items-center")}
    >
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-fg">
        <input
          type="checkbox"
          checked={!!filter.archived}
          onChange={(e) => onChange({ ...filter, archived: e.target.checked || undefined })}
        />
        보관 보기
      </label>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-fg">
        <input
          type="checkbox"
          checked={!!filter.orphans}
          onChange={(e) => onChange({ ...filter, orphans: e.target.checked || undefined })}
        />
        연결 없는 항목만
      </label>
    </div>
  );
  const reset = !isDefaultFilter(filter) ? (
    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange({})}>
      필터 초기화
    </Button>
  ) : null;

  const colorSection =
    colorBy && onColorByChange ? (
      <ColorByToggle key="color" value={colorBy} onChange={onColorByChange} />
    ) : null;

  if (compact) {
    const hidden = hiddenFilterCount(filter);
    return (
      <div className="flex items-center gap-3">
        {colorSection ? (
          <>
            {colorSection}
            <Divider />
          </>
        ) : null}
        {typesSection}
        <Divider />
        <FilterPopover label={`필터${hidden ? ` ${hidden}` : ""}`}>
          {selectsSection}
          {checksSection}
        </FilterPopover>
        {reset}
      </div>
    );
  }

  const sections = [colorSection, typesSection, selectsSection, checksSection].filter(Boolean);
  return (
    <div className={cn("flex", stacked ? "flex-col items-start gap-3" : "items-center gap-3")}>
      {sections.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && !stacked ? <Divider /> : null}
          {s}
        </Fragment>
      ))}
      {reset}
    </div>
  );
}

/** "필터 n" button with the less-used controls in a Radix popover (Esc or outside click closes). */
function FilterPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="shrink-0">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="flex w-max flex-col gap-3 rounded-lg border-border bg-bg p-3 shadow-overlay"
      >
        {children}
      </PopoverContent>
    </PopoverRoot>
  );
}
