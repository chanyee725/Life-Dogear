"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  Button,
  FilterBar,
  LinkButton,
  RowList,
  SearchInput,
  Segmented,
  Select,
} from "@/components/ui";
import { GoalListRow } from "./GoalListRow";
import {
  endedCounts,
  filterGroupsByText,
  filterLabels,
  groupStats,
  titleMatches,
  type GoalGroup,
  type ListGoal,
  type PeriodFilter,
} from "./list-view";
import { itemPath } from "@/lib/item-path";

export type PeriodKey = "quarter" | "year" | "all";
export type PeriodChoice = { value: PeriodKey; label: string; href: string };
export type YearChoice = { value: string; href: string };
export type AreaChoice = { value: string; label: string; href: string };

/**
 * The 목표 list below the 인생 목표 card: one filter bar (period and area in the URL, a
 * text filter in the page), active goals grouped by area, and the folded "끝난 목표".
 */
export function GoalList({
  groups,
  ended,
  periodChoices,
  periodValue,
  yearChoices,
  selectedYear,
  areaChoices,
  selectedArea,
  areaTitles,
  period,
  areaTitle,
  today,
  resetHref,
}: {
  groups: GoalGroup[];
  ended: ListGoal[];
  periodChoices: PeriodChoice[];
  /** null: a period outside the choices (e.g. `?period=2027`). */
  periodValue: PeriodKey | null;
  /** Years with goals other than this one (empty: no year select). */
  yearChoices: YearChoice[];
  /** The other year shown, or "". */
  selectedYear: string;
  areaChoices: AreaChoice[];
  selectedArea: string;
  /** Area id → title, for the rows. */
  areaTitles: Record<string, string>;
  period: PeriodFilter;
  areaTitle?: string;
  /** `YYYY-MM-DD`, for the days-left labels. */
  today: string;
  resetHref: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const shownGroups = filterGroupsByText(groups, query);
  const shownEnded = ended.filter((g) => titleMatches(g.title, query));
  const reasons = filterLabels({ period, areaTitle, query });
  const titleOf = (areaId: string | null) => (areaId ? areaTitles[areaId] : undefined);

  return (
    <>
      <FilterBar
        className="mb-1"
        end={
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="목표 찾기…"
            aria-label="목표 찾기"
            className="w-full sm:w-52"
          />
        }
      >
        <Segmented
          ariaLabel="기간"
          options={periodChoices}
          value={periodValue}
          onChange={(value) => {
            const choice = periodChoices.find((c) => c.value === value);
            if (choice) router.push(choice.href);
          }}
        />
        {yearChoices.length ? (
          <Select
            aria-label="다른 연도"
            size="sm"
            value={selectedYear}
            onChange={(e) => {
              const choice = yearChoices.find((y) => y.value === e.target.value);
              if (choice) router.push(choice.href);
            }}
            className="w-auto min-w-0"
          >
            <option value="" disabled>
              다른 연도
            </option>
            {yearChoices.map((y) => (
              <option key={y.value} value={y.value}>
                {y.value}년
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          aria-label="영역"
          size="sm"
          value={selectedArea}
          onChange={(e) => {
            const choice = areaChoices.find((a) => a.value === e.target.value);
            if (choice) router.push(choice.href);
          }}
          className="w-auto max-w-[12rem] min-w-0"
        >
          {areaChoices.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {shownGroups.length ? (
        shownGroups.map((group) => (
          <Group key={group.areaId ?? "none"} group={group} today={today} />
        ))
      ) : (
        <NothingShown
          reasons={reasons}
          resetHref={resetHref}
          onClearQuery={query.trim() ? () => setQuery("") : undefined}
        />
      )}

      {shownEnded.length ? <Ended goals={shownEnded} today={today} titleOf={titleOf} /> : null}
    </>
  );
}

/** A goal and its sub-goals (any depth) as rows with their depth. */
function withDepth(goals: readonly ListGoal[], depth = 0): { goal: ListGoal; depth: number }[] {
  return goals.flatMap((goal) => [{ goal, depth }, ...withDepth(goal.children, depth + 1)]);
}

/** One area's goals. The heading names the area, so the rows leave it out. */
function Group({ group, today }: { group: GoalGroup; today: string }) {
  const headingId = useId();
  const { count, average } = groupStats(group.goals);
  return (
    <section aria-labelledby={headingId} className="pt-5">
      <h2 id={headingId} className="mb-1.5 truncate text-xs text-muted tabular-nums">
        {group.areaId ? (
          <Link
            href={itemPath("areas", group.areaId, group.title)}
            className="rounded-sm font-medium text-fg hover:underline"
          >
            {group.title}
          </Link>
        ) : (
          <span className="font-medium">{group.title}</span>
        )}
        {` · ${count}개`}
        {average !== null ? ` · 평균 ${average}%` : ""}
      </h2>
      <RowList>
        {withDepth(group.goals).map(({ goal, depth }) => (
          <GoalListRow key={goal.id} goal={goal} depth={depth} today={today} />
        ))}
      </RowList>
    </section>
  );
}

function NothingShown({
  reasons,
  resetHref,
  onClearQuery,
}: {
  reasons: string[];
  resetHref: string;
  onClearQuery?: () => void;
}) {
  if (!reasons.length) {
    return (
      <div className="mt-5 rounded-lg border border-border px-4 py-6 text-sm text-muted">
        <p>진행 중인 연·분기 목표가 없습니다.</p>
        <LinkButton href="/goals/new?horizon=year" size="sm" className="mt-3">
          연 목표 만들기
        </LinkButton>
      </div>
    );
  }
  return (
    <div role="status" className="mt-5 rounded-lg border border-border px-4 py-6 text-sm">
      <p>
        <span className="text-fg">{reasons.join(" · ")}</span>
        <span className="text-muted">에 해당하는 진행 중인 목표가 없습니다.</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <LinkButton href={resetHref} onClick={onClearQuery} size="sm">
          전체 보기
        </LinkButton>
        {onClearQuery ? (
          <Button variant="ghost" size="sm" onClick={onClearQuery}>
            검색어 지우기
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Ended({
  goals,
  today,
  titleOf,
}: {
  goals: ListGoal[];
  today: string;
  titleOf: (areaId: string | null) => string | undefined;
}) {
  const { achieved, dropped } = endedCounts(goals);
  const parts = [achieved ? `달성 ${achieved}` : "", dropped ? `내려놓음 ${dropped}` : ""].filter(
    Boolean,
  );
  return (
    <details className="group mt-8">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md py-1.5 pr-2 text-[13px] text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="w-3 text-center text-xs transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          ▸
        </span>
        <span>
          끝난 목표 <span className="tabular-nums">{goals.length}</span>
        </span>
        {parts.length ? (
          <span className="text-xs text-faint tabular-nums">({parts.join(" · ")})</span>
        ) : null}
      </summary>
      <RowList className="mt-1">
        {goals.map((goal) => (
          <GoalListRow
            key={goal.id}
            goal={goal}
            today={today}
            areaTitle={titleOf(goal.areaId)}
            showStatus
          />
        ))}
      </RowList>
    </details>
  );
}
