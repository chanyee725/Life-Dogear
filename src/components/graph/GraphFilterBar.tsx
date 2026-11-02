"use client";

import { Fragment, useId } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { GraphFilter, GraphNodeType } from "@/lib/graph/types";
import type { GraphTheme } from "./graph-theme";
import {
  GRAPH_TYPE_LABEL,
  GRAPH_TYPE_ORDER,
  isDefaultFilter,
  OPT_IN_TYPES,
  shownTypes,
} from "./model";
import { ShapeIcon } from "./ShapeIcon";

export type FilterOptions = {
  areas: readonly { id: string; title: string }[];
  tags: readonly string[];
};

const Divider = () => <span aria-hidden className="h-4 w-px shrink-0 bg-border" />;

const selectClass =
  "rb-select h-7 max-w-44 cursor-pointer rounded-md border border-border bg-bg pr-7 pl-2 text-[13px] text-fg hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-ring focus:outline-none";

/**
 * Filter controls (design 6.2): type chips (also the legend), area and topic selects,
 * archived / orphans checkboxes, reset. `stacked` lays them out vertically (narrow panel).
 */
export function GraphFilterControls({
  filter,
  onChange,
  options,
  theme,
  stacked = false,
}: {
  filter: GraphFilter;
  onChange: (next: GraphFilter) => void;
  options: FilterOptions;
  theme: GraphTheme;
  stacked?: boolean;
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
        <ShapeIcon
          type={type}
          horizon={type === "goal" ? "year" : undefined}
          theme={theme}
          className={on ? "" : "opacity-35"}
        />
        {GRAPH_TYPE_LABEL[type]}
      </button>
    );
  };

  const main = GRAPH_TYPE_ORDER.filter((t) => !OPT_IN_TYPES.includes(t));
  const sections = [
    <div key="types" role="group" aria-label="종류" className="flex flex-wrap items-center gap-1.5">
      {main.map(chip)}
      <Divider />
      {OPT_IN_TYPES.map(chip)}
    </div>,
    <div key="selects" className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5">
        <label htmlFor={`${id}-area`} className="text-[13px] text-muted">
          영역
        </label>
        <select
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
        </select>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <label htmlFor={`${id}-tag`} className="text-[13px] text-muted">
          주제
        </label>
        <select
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
        </select>
      </span>
    </div>,
    <div key="checks" className="flex flex-wrap items-center gap-3">
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
    </div>,
  ];

  return (
    <div className={cn("flex", stacked ? "flex-col items-start gap-3" : "items-center gap-3")}>
      {sections.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && !stacked ? <Divider /> : null}
          {s}
        </Fragment>
      ))}
      {!isDefaultFilter(filter) ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          필터 초기화
        </Button>
      ) : null}
    </div>
  );
}
