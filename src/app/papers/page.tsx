import type { Metadata } from "next";
import { formatAuthors, formatRelative, paperByline } from "@/components/dashboard/format";
import {
  countTags,
  filterByTag,
  FilterChips,
  groupByKey,
  groupByYear,
  ItemCards,
  ItemTable,
  ListView,
  parseGroup,
  SortSelect,
  TopicPicker,
  topicOptions,
  buildHref,
  type Column,
  type ItemGroup,
  type QueryParams,
} from "@/components/list";
import { ProgressBar } from "@/components/pdf/ProgressBar";
import { Page, PageHeader } from "@/components/shell";
import { Badge, ListEmpty, NewItemButton, TagChip } from "@/components/ui";
import { IMPORTANCE, READ_STATUS } from "@/lib/enums";
import { papers } from "@/lib/repo";
import type { Paper, PaperSort } from "@/lib/repo/papers";

export const metadata: Metadata = { title: "논문" };
export const dynamic = "force-dynamic";

const BASE = "/papers";

const SORTS: { value: PaperSort; label: string }[] = [
  { value: "updated", label: "최근 수정순" },
  { value: "lastRead", label: "최근 읽음순" },
  { value: "created", label: "추가한 순" },
  { value: "title", label: "제목순" },
  { value: "year", label: "연도순" },
];

type PaperGroup = "status" | "importance" | "year" | "none";

const GROUPS: { value: PaperGroup; label: string }[] = [
  { value: "status", label: "읽기 상태" },
  { value: "importance", label: "중요도" },
  { value: "year", label: "연도순" },
  { value: "none", label: "묶지 않음" },
];

// Reading first: what is open now, then the queue, then what is finished.
const STATUS_ORDER = ["reading", "to_read", "done"].map((value) => ({
  value,
  label: READ_STATUS.label(value as Paper["readStatus"]),
}));

function groupPapers(list: Paper[], group: PaperGroup): ItemGroup<Paper>[] | undefined {
  if (group === "status") return groupByKey(list, (p) => p.readStatus, STATUS_ORDER);
  if (group === "importance") return groupByKey(list, (p) => p.importance, IMPORTANCE.options);
  if (group === "year") return groupByYear(list, (p) => p.year);
  return undefined;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isSort = (v: unknown): v is PaperSort => SORTS.some((s) => s.value === v);

function readingCell(paper: Paper) {
  if (!paper.pdfPath) return <span className="text-faint">—</span>;
  if (!paper.lastPage) return <span className="text-muted">안 읽음</span>;
  return <ProgressBar current={paper.lastPage} total={paper.totalPages} className="w-32" />;
}

function Tags({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((t) => (
        <TagChip key={t}>#{t}</TagChip>
      ))}
    </div>
  );
}

const columns: Column<Paper>[] = [
  {
    key: "title",
    header: "제목",
    primary: true,
    render: (p) => p.title,
  },
  {
    key: "authors",
    header: "저자",
    hideBelow: "lg",
    isEmpty: (p) => !formatAuthors(p.authors),
    render: (p) => (
      <span className="block max-w-[14rem] truncate text-muted">{formatAuthors(p.authors)}</span>
    ),
  },
  {
    key: "year",
    header: "연도",
    isEmpty: (p) => p.year == null,
    render: (p) => <span className="text-muted tabular-nums">{p.year ?? ""}</span>,
  },
  {
    key: "status",
    header: "상태",
    render: (p) => (
      <div className="flex gap-1">
        <Badge tone={READ_STATUS.tone(p.readStatus)}>{READ_STATUS.label(p.readStatus)}</Badge>
        <Badge tone={IMPORTANCE.tone(p.importance)}>{IMPORTANCE.label(p.importance)}</Badge>
      </div>
    ),
  },
  { key: "progress", header: "읽기", isEmpty: (p) => !p.pdfPath, render: readingCell },
  {
    key: "tags",
    header: "태그",
    hideBelow: "lg",
    isEmpty: (p) => p.tags.length === 0,
    render: (p) => <Tags names={p.tags} />,
  },
];

function PaperCard({ paper }: { paper: Paper }) {
  const byline = paperByline(paper);
  return (
    <>
      <div className="flex gap-1">
        <Badge tone={READ_STATUS.tone(paper.readStatus)}>
          {READ_STATUS.label(paper.readStatus)}
        </Badge>
        <Badge tone={IMPORTANCE.tone(paper.importance)}>{IMPORTANCE.label(paper.importance)}</Badge>
      </div>
      <p className="font-medium text-fg">{paper.title}</p>
      {byline ? <p className="text-[13px] text-muted">{byline}</p> : null}
      {paper.summary ? (
        <p className="line-clamp-2 text-[13px] text-muted">{paper.summary}</p>
      ) : null}
      {paper.pdfPath && paper.lastPage ? (
        <ProgressBar current={paper.lastPage} total={paper.totalPages} />
      ) : null}
      <Tags names={paper.tags} />
      <p className="mt-auto text-xs text-muted">{formatRelative(paper.updatedAt)} 수정</p>
    </>
  );
}

export default async function PapersPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const status = first(params.status);
  const importance = first(params.importance);
  const tag = first(params.tag);
  const sort = first(params.sort);
  const group = parseGroup(first(params.group), GROUPS, "status");

  // Topics come from the papers shown before the topic filter, so every topic leads somewhere.
  const unfilteredByTag = await papers.list({
    status: READ_STATUS.is(status) ? status : undefined,
    importance: IMPORTANCE.is(importance) ? importance : undefined,
    sort: isSort(sort) ? sort : undefined,
  });
  const list = filterByTag(unfilteredByTag, tag);
  const groups = groupPapers(list, group);
  const filtered = Boolean(status || importance || tag);

  const empty = (
    <ListEmpty filtered={filtered} addHref="/papers/new" addLabel="＋ 새 논문" clearHref={BASE} />
  );

  return (
    <Page>
      <PageHeader
        title="논문"
        actions={<NewItemButton href="/papers/new">새 논문</NewItemButton>}
      />
      <ListView
        storageKey="papers"
        toolbar={
          <>
            <FilterChips
              ariaLabel="읽기 상태"
              param="status"
              basePath={BASE}
              params={params}
              selected={status}
              allLabel="모든 상태"
              options={READ_STATUS.options}
            />
            <FilterChips
              ariaLabel="중요도"
              param="importance"
              basePath={BASE}
              params={params}
              selected={importance}
              allLabel="모든 중요도"
              options={IMPORTANCE.options}
            />
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
              <TopicPicker
                topics={topicOptions(countTags(unfilteredByTag), BASE, params)}
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
                  value={isSort(sort) ? sort : "updated"}
                  basePath={BASE}
                  params={params}
                />
              </div>
            </div>
          </>
        }
        table={
          <ItemTable
            items={list}
            groups={groups}
            columns={columns}
            getKey={(p) => p.id}
            getHref={(p) => `/papers/${p.id}`}
            empty={empty}
          />
        }
        cards={
          <ItemCards
            items={list}
            groups={groups}
            getKey={(p) => p.id}
            getHref={(p) => `/papers/${p.id}`}
            renderCard={(p) => <PaperCard paper={p} />}
            empty={empty}
          />
        }
      />
    </Page>
  );
}
