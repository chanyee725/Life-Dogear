import type { Metadata } from "next";
import Link from "next/link";
import { formatAuthors, formatRelative, paperByline } from "@/components/dashboard/format";
import {
  FilterChips,
  ItemCards,
  ItemTable,
  ListView,
  TagFilter,
  type Column,
  type QueryParams,
} from "@/components/list";
import { ProgressBar } from "@/components/pdf/ProgressBar";
import { Page, PageHeader } from "@/components/shell";
import { Badge, buttonClass, EmptyState, Kbd, TagChip } from "@/components/ui";
import { IMPORTANCE, READ_STATUS } from "@/lib/enums";
import { papers, tags } from "@/lib/repo";
import type { Paper, PaperSort } from "@/lib/repo/papers";

export const metadata: Metadata = { title: "논문" };
export const dynamic = "force-dynamic";

const BASE = "/papers";

const SORTS: { value: PaperSort; label: string }[] = [
  { value: "updated", label: "최근 수정" },
  { value: "lastRead", label: "최근 읽음" },
  { value: "created", label: "추가한 순" },
  { value: "title", label: "제목" },
  { value: "year", label: "연도" },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isSort = (v: unknown): v is PaperSort => SORTS.some((s) => s.value === v);

function readingCell(paper: Paper) {
  if (!paper.pdfPath) return <span className="text-faint">—</span>;
  if (!paper.lastPage) return <span className="text-faint">안 읽음</span>;
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
    className: "max-w-[22rem]",
  },
  {
    key: "authors",
    header: "저자",
    render: (p) => <span className="text-muted">{formatAuthors(p.authors)}</span>,
  },
  {
    key: "year",
    header: "연도",
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
  { key: "progress", header: "읽기", render: readingCell },
  { key: "tags", header: "태그", render: (p) => <Tags names={p.tags} /> },
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
      <p className="mt-auto text-xs text-faint">{formatRelative(paper.updatedAt)} 수정</p>
    </>
  );
}

export default async function PapersPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const status = first(params.status);
  const importance = first(params.importance);
  const tag = first(params.tag);
  const sort = first(params.sort);

  const [list, allTags] = await Promise.all([
    papers.list({
      status: READ_STATUS.is(status) ? status : undefined,
      importance: IMPORTANCE.is(importance) ? importance : undefined,
      tag: tag || undefined,
      sort: isSort(sort) ? sort : undefined,
    }),
    tags.listAll(),
  ]);
  const filtered = Boolean(status || importance || tag);

  const newButton = (
    <Link href="/papers/new" className={buttonClass("primary")}>
      새 논문 <Kbd className="border-accent-fg/30 bg-transparent text-accent-fg/80">N</Kbd>
    </Link>
  );

  const empty = filtered ? (
    <EmptyState
      title="조건에 맞는 논문이 없습니다"
      action={
        <Link href={BASE} className={buttonClass("secondary", "sm")}>
          필터 지우기
        </Link>
      }
    />
  ) : (
    <EmptyState
      title="아직 논문이 없습니다"
      description="읽을 논문을 추가하고 PDF를 올려 두면 읽던 곳부터 이어 읽을 수 있어요."
      action={newButton}
    />
  );

  return (
    <Page>
      <PageHeader title="논문" actions={newButton} />
      <ListView
        storageKey="papers"
        toolbar={
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <FilterChips
                ariaLabel="읽기 상태"
                param="status"
                basePath={BASE}
                params={params}
                selected={status}
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
              <FilterChips
                ariaLabel="정렬"
                param="sort"
                basePath={BASE}
                params={params}
                selected={isSort(sort) && sort !== "updated" ? sort : undefined}
                allLabel="최근 수정"
                options={SORTS.slice(1)}
              />
            </div>
            <TagFilter tags={allTags} selected={tag} basePath={BASE} params={params} />
          </div>
        }
        table={
          <ItemTable
            items={list}
            columns={columns}
            getKey={(p) => p.id}
            getHref={(p) => `/papers/${p.id}`}
            empty={empty}
          />
        }
        cards={
          <ItemCards
            items={list}
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
