"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Select } from "@/components/ui/Input";
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
import { Button, LinkButton } from "@/components/ui";
import { ChipCount, ChipLink, SearchInput } from "@/components/ui";

export type PeriodChip = {
  key: string;
  label: string;
  sub?: string;
  href: string;
  active: boolean;
};
export type AreaChoice = { value: string; label: string; href: string };

/**
 * The 목표 list below the "방향" line: period chips and area select (URL), a text filter
 * (here, in the page), active goals grouped by area, and the folded "끝난 목표".
 */
export function GoalList({
  groups,
  ended,
  periodChips,
  areaChoices,
  selectedArea,
  period,
  areaTitle,
  resetHref,
}: {
  groups: GoalGroup[];
  ended: ListGoal[];
  periodChips: PeriodChip[];
  areaChoices: AreaChoice[];
  selectedArea: string;
  period: PeriodFilter;
  areaTitle?: string;
  resetHref: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const areaSelectId = useId();
  const shownGroups = filterGroupsByText(groups, query);
  const shownEnded = ended.filter((g) => titleMatches(g.title, query));
  const reasons = filterLabels({ period, areaTitle, query });

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <nav aria-label="기간" className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[13px] text-muted">기간</span>
          {periodChips.map((c) => (
            <ChipLink key={c.key} href={c.href} active={c.active}>
              {c.label}
              {c.sub ? <ChipCount>{c.sub}</ChipCount> : null}
            </ChipLink>
          ))}
        </nav>
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={areaSelectId} className="text-[13px] text-muted">
            영역
          </label>
          <Select
            id={areaSelectId}
            value={selectedArea}
            onChange={(e) => {
              const choice = areaChoices.find((a) => a.value === e.target.value);
              if (choice) router.push(choice.href);
            }}
            className="h-7 w-auto max-w-[12rem] min-w-0 text-[13px]"
          >
            {areaChoices.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="목표 찾기…"
          aria-label="목표 찾기"
          className="w-full sm:ml-auto sm:w-48"
        />
      </div>

      {shownGroups.length ? (
        shownGroups.map((group) => <Group key={group.areaId ?? "none"} group={group} />)
      ) : (
        <NothingShown
          reasons={reasons}
          resetHref={resetHref}
          onClearQuery={query.trim() ? () => setQuery("") : undefined}
        />
      )}

      {shownEnded.length ? <Ended goals={shownEnded} /> : null}
    </>
  );
}

function Group({ group }: { group: GoalGroup }) {
  const headingId = useId();
  const { count, average } = groupStats(group.goals);
  return (
    <section aria-labelledby={headingId} className="pt-5">
      <div className="flex items-center gap-3 pb-1">
        <h2 id={headingId} className="min-w-0 truncate text-[13px] font-medium">
          {group.areaId ? (
            <Link href={`/areas/${group.areaId}`} className="rounded-sm hover:underline">
              {group.title}
            </Link>
          ) : (
            <span className="text-muted">{group.title}</span>
          )}
        </h2>
        <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
        <span className="shrink-0 text-xs text-muted tabular-nums">
          목표 {count}
          {average !== null ? ` · 평균 ${average}%` : ""}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {group.goals.map((goal) => (
          <li key={goal.id}>
            <GoalListRow goal={goal} />
            {goal.children.length ? (
              <ul
                aria-label={`${goal.title}의 분기 목표`}
                className="mb-1.5 ml-2.5 divide-y divide-border border-l border-border pl-3"
              >
                {goal.children.map((child) => (
                  <li key={child.id}>
                    <GoalListRow goal={child} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
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
      <div className="mt-5 border-y border-border py-6 text-sm text-muted">
        <p>진행 중인 연·분기 목표가 없습니다.</p>
        <LinkButton href="/goals/new?horizon=year" size="sm" className="mt-3">
          연 목표 만들기
        </LinkButton>
      </div>
    );
  }
  return (
    <div role="status" className="mt-5 border-y border-border py-6 text-sm">
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

function Ended({ goals }: { goals: ListGoal[] }) {
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
      <ul className="mt-1 divide-y divide-border border-y border-border">
        {goals.map((goal) => (
          <li key={goal.id}>
            <GoalListRow goal={goal} showStatus />
          </li>
        ))}
      </ul>
    </details>
  );
}
