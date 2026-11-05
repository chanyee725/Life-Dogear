"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { reorderAreas } from "@/app/_actions/areas";
import { safeAction } from "@/components/links/safe-action";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  Button,
  cardClass,
  cardLinkClass,
  cn,
  formatDate,
  NewItemButton,
  RowList,
  SearchInput,
} from "@/components/ui";
import {
  AREA_SORTS,
  areaCountParts,
  careSignal,
  filterAreas,
  sortAreas,
  type AreaSort,
} from "./list";
import { itemPath } from "@/lib/item-path";

export type AreaRow = {
  id: string;
  title: string;
  standard: string;
  lastActivity: string;
  openProjects: number;
  activeGoals: number;
  notes: number;
};

/**
 * Areas list as a card grid: filter (title + 유지 기준, kept in `?q=`), sort (`?sort=`), and
 * a 순서 바꾸기 mode that shows 위로/아래로 buttons for the area order. Each card ends with
 * its open counts and care signal: when it was last touched, flagged after
 * `STALE_AFTER_DAYS` days.
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
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              ‘{query.trim()}’에 맞는 영역이 없습니다.
            </p>
          ) : (
            <ul aria-label="영역 목록" className={gridClass}>
              {visible.map((area) => (
                <li key={area.id}>
                  <AreaCard area={area} now={nowDate} />
                </li>
              ))}
            </ul>
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

// Same card shape and grid as the home "프로젝트" cards (GeneralProjects.tsx).
const gridClass = "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3";
const cardLink = cn(
  cardClass,
  cardLinkClass,
  "flex h-full min-h-28 flex-col gap-1.5 rounded-md p-3 text-sm",
  "focus-visible:ring-2 focus-visible:ring-ring",
);

function AreaCard({ area, now }: { area: AreaRow; now: Date }) {
  const signal = careSignal(area.lastActivity, now);
  const counts = areaCountParts(area);
  return (
    <Link href={itemPath("areas", area.id, area.title)} className={cardLink}>
      <span className="line-clamp-1 text-base font-semibold text-fg">{area.title}</span>
      {area.standard ? (
        <span className="line-clamp-2 text-[13px] leading-relaxed text-muted">{area.standard}</span>
      ) : null}
      <span className="mt-auto flex items-center gap-3 pt-2 text-xs tabular-nums">
        {counts.map(([label, n]) => (
          <span key={label} className="text-muted">
            {label} {n}
          </span>
        ))}
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1.5",
            signal.stale ? "text-tone-amber-fg" : "text-muted",
          )}
          title={`마지막 활동 ${formatDate(area.lastActivity)}`}
        >
          {signal.stale ? (
            <span aria-hidden className="size-1.5 rounded-full bg-tone-amber-fg" />
          ) : null}
          {signal.label}
        </span>
      </span>
    </Link>
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
