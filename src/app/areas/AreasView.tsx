"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { reorderAreas } from "@/app/_actions/areas";
import { safeAction } from "@/components/links/safe-action";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { formatDate } from "@/components/ui/format";
import { AREA_SORTS, careSignal, filterAreas, sortAreas, type AreaSort } from "./list";
import { NewItemButton, RowList } from "@/components/ui";
import { SearchInput } from "@/components/ui";

export type AreaRow = {
  id: string;
  title: string;
  standard: string;
  lastActivity: string;
  openProjects: number;
  activeGoals: number;
  openTasks: number;
};

/**
 * Areas list: filter (title + 유지 기준, kept in `?q=`), sort (`?sort=`), and a 순서 바꾸기
 * mode that shows 위로/아래로 buttons for the area order. Each row ends with its care
 * signal: when it was last touched, flagged after `STALE_AFTER_DAYS` days.
 */
export function AreasView({
  areas,
  sort,
  initialQuery,
  now,
}: {
  areas: AreaRow[];
  sort: AreaSort;
  initialQuery: string;
  /** Server time (ISO), so relative times match between server and client render. */
  now: string;
}) {
  const [reordering, setReordering] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const nowDate = useMemo(() => new Date(now), [now]);

  function changeQuery(value: string) {
    setQuery(value);
    // Keep the filter in the URL without a server round trip.
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  const visible = useMemo(() => sortAreas(filterAreas(areas, query), sort), [areas, query, sort]);

  return (
    <>
      <PageHeader
        title="영역"
        actions={
          <>
            <Button
              variant={reordering ? "primary" : "secondary"}
              aria-pressed={reordering}
              onClick={() => setReordering((r) => !r)}
            >
              {reordering ? "순서 바꾸기 끝내기" : "순서 바꾸기"}
            </Button>
            {reordering ? null : <NewItemButton href="/areas/new">새 영역</NewItemButton>}
          </>
        }
      />
      {reordering ? (
        // Remount after a server refresh so the order matches the database.
        <ReorderList key={areas.map((a) => a.id).join(",")} areas={areas} />
      ) : (
        <div className="flex flex-col gap-3">
          <Toolbar sort={sort} query={query} onQuery={changeQuery} />
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              ‘{query.trim()}’에 맞는 영역이 없습니다.
            </p>
          ) : (
            <RowList aria-label="영역 목록">
              {visible.map((area) => (
                <AreaListRow key={area.id} area={area} now={nowDate} />
              ))}
            </RowList>
          )}
          {query.trim() && visible.length > 0 ? (
            <p className="text-xs text-muted" aria-live="polite">
              {areas.length}개 중 {visible.length}개를 보여 줍니다.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

function Toolbar({
  sort,
  query,
  onQuery,
}: {
  sort: AreaSort;
  query: string;
  onQuery: (value: string) => void;
}) {
  const sortLabelId = useId();
  const hrefFor = (value: AreaSort) => {
    const params = new URLSearchParams();
    if (value !== "order") params.set("sort", value);
    if (query.trim()) params.set("q", query);
    const qs = params.toString();
    return qs ? `/areas?${qs}` : "/areas";
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <SearchInput
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onClear={() => onQuery("")}
        placeholder="영역 찾기"
        aria-label="영역 찾기 (이름이나 유지 기준)"
        className="sm:max-w-64"
      />
      <nav
        aria-labelledby={sortLabelId}
        className="flex flex-wrap items-center gap-x-1 text-[13px]"
      >
        <span id={sortLabelId} className="mr-1 text-muted">
          정렬
        </span>
        {AREA_SORTS.map((s, i) => (
          <span key={s.value} className="flex items-center gap-x-1">
            {i > 0 ? (
              <span aria-hidden className="text-faint">
                ·
              </span>
            ) : null}
            <Link
              href={hrefFor(s.value)}
              replace
              scroll={false}
              aria-current={s.value === sort ? "true" : undefined}
              className={cn(
                "rounded-md px-1 py-0.5 transition-colors",
                s.value === sort ? "font-medium text-fg" : "text-muted hover:text-fg",
              )}
            >
              {s.label}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  );
}

/** Open counts; zero is left out. On wide screens each count keeps its column. */
function Counts({ area }: { area: AreaRow }) {
  const parts = [
    ["프로젝트", area.openProjects],
    ["목표", area.activeGoals],
    ["할 일", area.openTasks],
  ] as const;
  if (parts.every(([, n]) => n === 0)) return <span className="hidden sm:block sm:w-[13.5rem]" />;
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs text-muted tabular-nums sm:gap-0">
      {parts.map(([label, n]) =>
        n > 0 ? (
          <span key={label} className="sm:w-[4.5rem] sm:text-right">
            {label} {n}
          </span>
        ) : (
          <span key={label} aria-hidden className="hidden sm:block sm:w-[4.5rem]" />
        ),
      )}
    </span>
  );
}

function AreaListRow({ area, now }: { area: AreaRow; now: Date }) {
  const signal = careSignal(area.lastActivity, now);
  return (
    <li className="flex items-start gap-1 px-3 py-2 sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5 sm:flex-row sm:items-center sm:gap-4 sm:pt-0">
        <Link
          href={`/areas/${area.id}`}
          className="group flex min-w-0 flex-1 flex-col rounded-md sm:flex-row sm:items-baseline sm:gap-3"
        >
          <span className="truncate text-sm font-medium group-hover:underline sm:max-w-[40%] sm:shrink-0">
            {area.title}
          </span>
          {area.standard ? (
            <span className="min-w-0 truncate text-[13px] text-muted">{area.standard}</span>
          ) : null}
        </Link>
        <div className="flex items-center justify-between gap-3 sm:contents">
          <Counts area={area} />
          <span
            className={cn(
              "ml-auto flex shrink-0 items-center justify-end gap-1.5 text-xs tabular-nums sm:w-36",
              signal.stale ? "text-tone-amber-fg" : "text-faint",
            )}
            title={`마지막 활동 ${formatDate(area.lastActivity)}`}
          >
            {signal.stale ? (
              <span aria-hidden className="size-1.5 rounded-full bg-tone-amber-fg" />
            ) : null}
            {signal.label}
          </span>
        </div>
      </div>
    </li>
  );
}

/** Sidebar order with 위로/아래로 buttons; every move is saved right away. */
function ReorderList({ areas }: { areas: AreaRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(areas);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    const previous = rows;
    setRows(next);
    setError(null);
    startTransition(async () => {
      const result = await safeAction(() => reorderAreas(next.map((r) => r.id)));
      if (!result.ok) {
        setRows(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const arrow =
    "flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-30";

  return (
    <div className="flex flex-col gap-3">
      <RowList aria-label="영역 순서">
        {rows.map((area, i) => (
          <li
            key={area.id}
            className={cn("flex items-center gap-2 py-1.5 pr-2 pl-3", pending && "opacity-80")}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{area.title}</span>
            <button
              type="button"
              className={arrow}
              aria-label={`${area.title} 위로`}
              disabled={pending || i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={arrow}
              aria-label={`${area.title} 아래로`}
              disabled={pending || i === rows.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </RowList>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
