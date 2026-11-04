import type { Metadata } from "next";
import Link from "next/link";
import { ItemCards } from "@/components/list/ItemCards";
import { ItemTable, type Column } from "@/components/list/ItemTable";
import { groupByKey, parseGroup, type ItemGroup } from "@/components/list/groups";
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
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelative } from "@/components/ui/format";
import { NOTE_SOURCE_KIND } from "@/lib/enums";
import { areas, notes } from "@/lib/repo";
import type { Note, NoteSort } from "@/lib/repo/notes";
import { bodyPreview } from "./source";

export const metadata: Metadata = { title: "노트" };
export const dynamic = "force-dynamic";

const SORTS: { value: NoteSort; label: string }[] = [
  { value: "updated", label: "최근 수정순" },
  { value: "created", label: "최근 생성순" },
  { value: "title", label: "제목순" },
];

type NoteGroup = "source" | "none";

const GROUPS: { value: NoteGroup; label: string }[] = [
  { value: "source", label: "출처 종류" },
  { value: "none", label: "묶지 않음" },
];

const NO_SOURCE = "none";
const SOURCE_GROUPS = [...NOTE_SOURCE_KIND.options, { value: NO_SOURCE, label: "출처 없음" }];

function groupNotes(list: Note[], group: NoteGroup): ItemGroup<Note>[] | undefined {
  if (group === "source") return groupByKey(list, (n) => n.sourceKind ?? NO_SOURCE, SOURCE_GROUPS);
  return undefined;
}

const BASE = "/notes";
const href = (n: Note) => `/notes/${n.id}`;

function sourceBadge(n: Note) {
  return NOTE_SOURCE_KIND.is(n.sourceKind) ? (
    <Badge tone={NOTE_SOURCE_KIND.tone(n.sourceKind)}>{NOTE_SOURCE_KIND.label(n.sourceKind)}</Badge>
  ) : null;
}

export default async function NotesPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const sourceParam = firstParam(params, "source");
  const sourceKind = NOTE_SOURCE_KIND.is(sourceParam) ? sourceParam : undefined;
  const tag = firstParam(params, "tag");
  const sortParam = firstParam(params, "sort");
  const sort = SORTS.find((s) => s.value === sortParam)?.value ?? "updated";
  const group = parseGroup(firstParam(params, "group"), GROUPS, "none");

  const [all, areaList] = await Promise.all([
    notes.list({ sourceKind, sort }),
    areas.list({ includeArchived: true }),
  ]);
  const areaTitle = new Map(areaList.map((a) => [a.id, a.title]));
  const items = filterByTag(all, tag);
  const groups = groupNotes(items, group);
  const filtered = Boolean(sourceKind || tag);

  const columns: Column<Note>[] = [
    { key: "title", header: "제목", primary: true, render: (n) => n.title },
    { key: "source", header: "출처 종류", render: sourceBadge },
    {
      key: "sourceTitle",
      header: "출처",
      hideBelow: "lg",
      className: "max-w-[16rem] truncate text-muted",
      render: (n) => n.sourceTitle ?? "",
    },
    {
      key: "area",
      header: "영역",
      hideBelow: "lg",
      className: "text-muted",
      render: (n) => (n.areaId ? (areaTitle.get(n.areaId) ?? "") : ""),
    },
    { key: "tags", header: "태그", render: (n) => <TagList tags={n.tags} /> },
    {
      key: "updated",
      header: "수정",
      className: "text-muted tabular-nums whitespace-nowrap",
      render: (n) => formatRelative(n.updatedAt),
    },
  ];

  const empty = (
    <EmptyState
      title={filtered ? "조건에 맞는 노트가 없습니다" : "아직 노트가 없습니다"}
      description={
        filtered
          ? "필터를 바꾸거나 해제해 보세요."
          : "책·강의·영상에서 공부한 내용을 정리해 두세요."
      }
      action={
        filtered ? (
          <Link href={BASE} className={buttonClass("secondary", "sm")}>
            필터 해제
          </Link>
        ) : (
          <Link href="/notes/new" className={buttonClass("primary", "sm")}>
            새 노트
          </Link>
        )
      }
    />
  );

  return (
    <Page>
      <PageHeader
        title="노트"
        actions={
          <Link href="/notes/new" className={buttonClass("primary")}>
            새 노트
          </Link>
        }
      />
      <ListView
        storageKey="notes"
        toolbar={
          <>
            <FilterChips
              ariaLabel="출처 종류 필터"
              param="source"
              basePath={BASE}
              params={params}
              selected={sourceKind}
              allLabel="모든 출처"
              options={NOTE_SOURCE_KIND.options}
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
            getKey={(n) => n.id}
            getHref={href}
            empty={empty}
          />
        }
        cards={
          <ItemCards
            items={items}
            groups={groups}
            getKey={(n) => n.id}
            getHref={href}
            empty={empty}
            renderCard={(n) => (
              <>
                <span className="font-medium">{n.title}</span>
                {n.sourceTitle ? (
                  <span className="truncate text-[13px] text-muted">{n.sourceTitle}</span>
                ) : null}
                {bodyPreview(n.body) ? (
                  <p className="line-clamp-3 text-[13px] text-muted">{bodyPreview(n.body)}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {sourceBadge(n)}
                  <TagList tags={n.tags} max={2} />
                </div>
              </>
            )}
          />
        }
      />
    </Page>
  );
}
