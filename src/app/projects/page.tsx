import type { Metadata } from "next";
import Link from "next/link";
import { ItemCards } from "@/components/list/ItemCards";
import { ItemTable, type Column } from "@/components/list/ItemTable";
import {
  buildHref,
  countTags,
  filterByTag,
  firstParam,
  type QueryParams,
} from "@/components/list/query";
import { SortSelect } from "@/components/list/SortSelect";
import { LinkTabs } from "@/components/ui/Tabs";
import { FilterChips, TagFilter } from "@/components/list/TagFilter";
import { TagList } from "@/components/list/TagList";
import { ListView } from "@/components/list/ViewToggle";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/components/ui/format";
import { PROJECT_KIND, PROJECT_STAGE, PROJECT_STATUS, type ProjectKind } from "@/lib/enums";
import { areas, projects } from "@/lib/repo";
import type { Project, ProjectSort } from "@/lib/repo/projects";
import { ProgressBadge } from "./ProgressBadge";

export const metadata: Metadata = { title: "프로젝트" };
export const dynamic = "force-dynamic";

const SORTS: { value: ProjectSort; label: string }[] = [
  { value: "updated", label: "최근 수정순" },
  { value: "due", label: "마감일순" },
  { value: "created", label: "최근 생성순" },
  { value: "title", label: "제목순" },
];

const BASE = "/projects";
const href = (p: Project) => `${BASE}/${p.id}`;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kind: ProjectKind = PROJECT_KIND.is(kindParam) ? kindParam : "research";
  const stageParam = firstParam(params, "stage");
  const stage = kind === "research" && PROJECT_STAGE.is(stageParam) ? stageParam : undefined;
  const statusParam = firstParam(params, "status");
  const status = kind === "general" && PROJECT_STATUS.is(statusParam) ? statusParam : undefined;
  const tag = firstParam(params, "tag");
  const sortParam = firstParam(params, "sort");
  const sort = SORTS.find((s) => s.value === sortParam)?.value ?? "updated";

  const [all, areaList, research, general] = await Promise.all([
    projects.list({ kind, stage, status, sort }),
    areas.list({ includeArchived: true }),
    projects.list({ kind: "research" }),
    projects.list({ kind: "general" }),
  ]);
  const areaTitle = new Map(areaList.map((a) => [a.id, a.title]));
  const items = filterByTag(all, tag);
  const filtered = Boolean(stage || status || tag);
  const kindLabel = PROJECT_KIND.label(kind);

  const columns: Column<Project>[] = [
    { key: "title", header: "제목", primary: true, render: (p) => p.title },
    {
      key: "progress",
      header: kind === "research" ? "단계" : "상태",
      render: (p) => <ProgressBadge project={p} />,
    },
    {
      key: "next",
      header: "다음 할 일",
      className: "max-w-64 truncate text-muted",
      render: (p) => p.nextAction,
    },
    {
      key: "area",
      header: "영역",
      className: "text-muted whitespace-nowrap",
      render: (p) => (p.areaId ? (areaTitle.get(p.areaId) ?? "") : ""),
    },
    {
      key: "due",
      header: "마감일",
      className: "text-muted tabular-nums",
      render: (p) => formatDate(p.dueDate),
    },
    { key: "tags", header: "태그", render: (p) => <TagList tags={p.tags} /> },
  ];

  const newHref = kind === "general" ? `${BASE}/new?kind=general` : `${BASE}/new`;
  const empty = (
    <EmptyState
      title={filtered ? "조건에 맞는 프로젝트가 없습니다" : `아직 ${kindLabel} 프로젝트가 없습니다`}
      action={
        filtered ? (
          <Link href={buildHref(BASE, { kind }, {})} className={buttonClass("secondary", "sm")}>
            필터 해제
          </Link>
        ) : (
          <Link href={newHref} className={buttonClass("primary", "sm")}>
            새 프로젝트
          </Link>
        )
      }
    />
  );

  return (
    <Page>
      <PageHeader
        title="프로젝트"
        actions={
          <Link
            aria-keyshortcuts="N"
            title="단축키 N"
            href={newHref}
            className={buttonClass("primary")}
          >
            새 프로젝트
          </Link>
        }
      />
      <LinkTabs
        ariaLabel="프로젝트 종류"
        active={kind}
        className="mb-5"
        tabs={[
          { value: "research", label: "연구", href: BASE, count: research.length },
          { value: "general", label: "그 외", href: `${BASE}?kind=general`, count: general.length },
        ]}
      />
      <ListView
        storageKey="projects"
        toolbar={
          <>
            {kind === "research" ? (
              <FilterChips
                ariaLabel="단계 필터"
                param="stage"
                basePath={BASE}
                params={params}
                selected={stage}
                options={PROJECT_STAGE.options}
              />
            ) : (
              <FilterChips
                ariaLabel="상태 필터"
                param="status"
                basePath={BASE}
                params={params}
                selected={status}
                options={PROJECT_STATUS.options}
              />
            )}
            <div className="ml-auto">
              <SortSelect options={SORTS} value={sort} basePath={BASE} params={params} />
            </div>
            <TagFilter
              tags={countTags(all)}
              selected={tag}
              basePath={BASE}
              params={params}
              className="w-full"
            />
          </>
        }
        table={
          <ItemTable
            items={items}
            columns={columns}
            getKey={(p) => p.id}
            getHref={href}
            empty={empty}
          />
        }
        cards={
          <ItemCards
            items={items}
            getKey={(p) => p.id}
            getHref={href}
            empty={empty}
            renderCard={(p) => (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <ProgressBadge project={p} />
                </div>
                {p.nextAction ? (
                  <p className="line-clamp-2 text-[13px] text-muted">다음: {p.nextAction}</p>
                ) : p.researchQuestion ? (
                  <p className="line-clamp-2 text-[13px] text-muted">{p.researchQuestion}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted">
                  <TagList tags={p.tags} />
                  <span className="tabular-nums">
                    {[
                      p.areaId ? areaTitle.get(p.areaId) : "",
                      p.dueDate ? `마감 ${formatDate(p.dueDate)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
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
