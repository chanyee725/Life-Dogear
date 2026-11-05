import type { Metadata } from "next";
import { ItemCards } from "@/components/list/ItemCards";
import { ItemTable, type Column } from "@/components/list/ItemTable";
import { groupByKey, groupByMonth, parseGroup, type ItemGroup } from "@/components/list/groups";
import {
  buildHref,
  countTags,
  filterByTag,
  firstParam,
  topicOptions,
  type QueryParams,
} from "@/components/list/query";
import { SortSelect } from "@/components/list/SortSelect";
import { FilterChips } from "@/components/list/TagFilter";
import { TagList } from "@/components/list/TagList";
import { TopicPicker } from "@/components/list/TopicPicker";
import { ListView } from "@/components/list/ViewToggle";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { Badge, ListEmpty, formatDate, NewItemButton } from "@/components/ui";
import { seoulDate } from "@/components/calendar/model";
import { SEMINAR_KIND } from "@/lib/enums";
import { seminars } from "@/lib/repo";
import type { Seminar, SeminarSort } from "@/lib/repo/seminars";

export const metadata: Metadata = { title: "세미나" };
export const dynamic = "force-dynamic";

const SORTS: { value: SeminarSort; label: string }[] = [
  { value: "date", label: "날짜순" },
  { value: "updated", label: "최근 수정순" },
  { value: "created", label: "최근 생성순" },
  { value: "title", label: "제목순" },
];

type SeminarGroup = "month" | "kind" | "none";

const GROUPS: { value: SeminarGroup; label: string }[] = [
  { value: "month", label: "월별" },
  { value: "kind", label: "종류" },
  { value: "none", label: "묶지 않음" },
];

function groupSeminars(list: Seminar[], group: SeminarGroup): ItemGroup<Seminar>[] | undefined {
  if (group === "month") return groupByMonth(list, (s) => s.date, seoulDate());
  if (group === "kind") return groupByKey(list, (s) => s.kind, SEMINAR_KIND.options);
  return undefined;
}

const BASE = "/seminars";
const href = (s: Seminar) => `/seminars/${s.id}`;

const columns: Column<Seminar>[] = [
  {
    key: "date",
    header: "날짜",
    className: "text-muted tabular-nums whitespace-nowrap",
    render: (s) => formatDate(s.date),
  },
  { key: "title", header: "제목", primary: true, render: (s) => s.title },
  {
    key: "kind",
    header: "종류",
    render: (s) => <Badge tone={SEMINAR_KIND.tone(s.kind)}>{SEMINAR_KIND.label(s.kind)}</Badge>,
  },
  { key: "speaker", header: "연사", className: "text-muted", render: (s) => s.speaker },
  { key: "tags", header: "태그", render: (s) => <TagList tags={s.tags} /> },
];

export default async function SeminarsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kind = SEMINAR_KIND.is(kindParam) ? kindParam : undefined;
  const tag = firstParam(params, "tag");
  const sortParam = firstParam(params, "sort");
  const sort = SORTS.find((s) => s.value === sortParam)?.value ?? "date";
  const group = parseGroup(firstParam(params, "group"), GROUPS, "month");

  const all = await seminars.list({ kind, sort });
  const items = filterByTag(all, tag);
  const groups = groupSeminars(items, group);
  const filtered = Boolean(kind || tag);

  const empty = (
    <ListEmpty
      filtered={filtered}
      addHref="/seminars/new"
      addLabel="＋ 새 세미나"
      clearHref="/seminars"
    />
  );

  return (
    <Page>
      <PageHeader
        title="세미나"
        actions={<NewItemButton href="/seminars/new">새 세미나</NewItemButton>}
      />
      <ListView
        storageKey="seminars"
        toolbar={
          <>
            <FilterChips
              ariaLabel="종류 필터"
              param="kind"
              basePath="/seminars"
              params={params}
              selected={kind}
              allLabel="모든 종류"
              options={SEMINAR_KIND.options}
            />
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
              <TopicPicker
                topics={topicOptions(countTags(all), BASE, params)}
                selected={tag}
                clearHref={buildHref(BASE, params, { tag: undefined })}
              />
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <SortSelect
                  label="묶기"
                  param="group"
                  options={GROUPS}
                  value={group}
                  basePath={BASE}
                  params={params}
                />
                <SortSelect
                  label="정렬"
                  options={SORTS}
                  value={sort}
                  basePath={BASE}
                  params={params}
                />
              </div>
            </div>
          </>
        }
        table={
          <ItemTable
            items={items}
            groups={groups}
            columns={columns}
            getKey={(s) => s.id}
            getHref={href}
            empty={empty}
          />
        }
        cards={
          <ItemCards
            items={items}
            groups={groups}
            getKey={(s) => s.id}
            getHref={href}
            empty={empty}
            renderCard={(s) => (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{s.title}</span>
                  <Badge tone={SEMINAR_KIND.tone(s.kind)}>{SEMINAR_KIND.label(s.kind)}</Badge>
                </div>
                {s.keyLine ? (
                  <p className="line-clamp-2 text-[13px] text-muted">{s.keyLine}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-faint">
                  <TagList tags={s.tags} />
                  <span className="tabular-nums">
                    {[formatDate(s.date), s.speaker].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </>
            )}
          />
        }
      />
    </Page>
  );
}
