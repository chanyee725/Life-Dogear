import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips, TagFilter } from "@/components/list/TagFilter";
import { ItemCards } from "@/components/list/ItemCards";
import { ItemTable, type Column } from "@/components/list/ItemTable";
import { countTags, filterByTag, firstParam, type QueryParams } from "@/components/list/query";
import { SortSelect } from "@/components/list/SortSelect";
import { TagList } from "@/components/list/TagList";
import { ListView } from "@/components/list/ViewToggle";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatRelative } from "@/components/ui/format";
import { PROJECT_STAGE } from "@/lib/enums";
import { projects } from "@/lib/repo";
import type { Project, ProjectSort } from "@/lib/repo/projects";

export const metadata: Metadata = { title: "연구" };
export const dynamic = "force-dynamic";

const SORTS: { value: ProjectSort; label: string }[] = [
  { value: "updated", label: "최근 수정순" },
  { value: "due", label: "마감일순" },
  { value: "created", label: "최근 생성순" },
  { value: "title", label: "제목순" },
];

const href = (p: Project) => `/projects/${p.id}`;

const columns: Column<Project>[] = [
  { key: "title", header: "제목", primary: true, render: (p) => p.title },
  {
    key: "stage",
    header: "단계",
    render: (p) => <Badge tone={PROJECT_STAGE.tone(p.stage)}>{PROJECT_STAGE.label(p.stage)}</Badge>,
  },
  {
    key: "due",
    header: "마감일",
    className: "text-muted tabular-nums",
    render: (p) => formatDate(p.dueDate),
  },
  { key: "tags", header: "태그", render: (p) => <TagList tags={p.tags} /> },
  {
    key: "updated",
    header: "수정",
    className: "text-muted tabular-nums whitespace-nowrap",
    render: (p) => formatRelative(p.updatedAt),
  },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const stageParam = firstParam(params, "stage");
  const stage = PROJECT_STAGE.is(stageParam) ? stageParam : undefined;
  const tag = firstParam(params, "tag");
  const sortParam = firstParam(params, "sort");
  const sort = SORTS.find((s) => s.value === sortParam)?.value ?? "updated";

  const all = await projects.list({ stage, sort });
  const items = filterByTag(all, tag);
  const filtered = Boolean(stage || tag);

  const empty = (
    <EmptyState
      title={filtered ? "조건에 맞는 연구가 없습니다" : "아직 연구가 없습니다"}
      description={
        filtered ? "필터를 바꾸거나 해제해 보세요." : "진행 중인 연구 프로젝트를 추가해 보세요."
      }
      action={
        filtered ? (
          <Link href="/projects" className={buttonClass("secondary", "sm")}>
            필터 해제
          </Link>
        ) : (
          <Link href="/projects/new" className={buttonClass("primary", "sm")}>
            새 연구
          </Link>
        )
      }
    />
  );

  return (
    <Page>
      <PageHeader
        title="연구"
        actions={
          <Link href="/projects/new" className={buttonClass("primary")}>
            새 연구
          </Link>
        }
      />
      <ListView
        storageKey="projects"
        toolbar={
          <>
            <FilterChips
              ariaLabel="단계 필터"
              param="stage"
              basePath="/projects"
              params={params}
              selected={stage}
              options={PROJECT_STAGE.options}
            />
            <div className="ml-auto">
              <SortSelect options={SORTS} value={sort} basePath="/projects" params={params} />
            </div>
            <TagFilter
              tags={countTags(all)}
              selected={tag}
              basePath="/projects"
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
                  <Badge tone={PROJECT_STAGE.tone(p.stage)}>{PROJECT_STAGE.label(p.stage)}</Badge>
                </div>
                {p.researchQuestion ? (
                  <p className="line-clamp-2 text-[13px] text-muted">{p.researchQuestion}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-faint">
                  <TagList tags={p.tags} />
                  {p.dueDate ? (
                    <span className="tabular-nums">마감 {formatDate(p.dueDate)}</span>
                  ) : null}
                </div>
              </>
            )}
          />
        }
      />
      <TagFilter
        tags={countTags(all)}
        selected={tag}
        basePath="/projects"
        params={params}
        className="mt-6"
      />
    </Page>
  );
}
