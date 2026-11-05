import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteArea } from "@/app/_actions/areas";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { KanbanCard, KanbanColumn } from "@/components/dashboard/ProjectKanban";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { Badge, EmptyAdd, LinkButton, RowList, Section } from "@/components/ui";
import { ItemNotes } from "@/components/notes/ItemNotes";
import { Page } from "@/components/shell/PageHeader";
import { isValidItemId } from "@/lib/ids";
import { ITEM_ROUTE, ITEM_TYPE, PROJECT_STATUS } from "@/lib/enums";
import { areas, goals, projects, tags } from "@/lib/repo";
import type { AreaProject } from "@/lib/repo/projects";
import { GoalTree } from "../../goals/GoalTree";
import { updateAreaPatch } from "../actions";
import { AreaFields } from "../AreaFields";
import {
  columnsByStatus,
  goalOrder,
  groupProjectsByGoal,
  type ProjectGroup,
  viaLabel,
} from "../flow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const area = isValidItemId(id) ? await areas.get(id) : null;
  return { title: area?.title ?? "영역" };
}

export default async function AreaDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isValidItemId(id)) notFound();
  const [area, allTags, areaProjects, areaGoals, allGoals, materials] = await Promise.all([
    areas.get(id),
    tags.listAll({ visibleOnly: true }),
    projects.listForArea(id),
    goals.listTreeForArea(id),
    goals.list({ includeArchived: true }),
    areas.listMaterials(id),
  ]);
  if (!area) notFound();
  const ref = { type: "area" as const, id: area.id };
  const goalTitles = new Map(
    allGoals.map((g) => [g.id, g.archivedAt ? `${g.title} (보관됨)` : g.title]),
  );
  const projectGroups = groupProjectsByGoal(areaProjects, goalOrder(areaGoals), goalTitles);
  // One group without a goal reads better as the plain list it used to be.
  const showGroupTitles = projectGroups.some((g) => g.goalId !== null);

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {area.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateAreaPatch.bind(null, area.id)}
          basePath="/areas"
          backLabel="영역"
          actions={
            <>
              {area.archivedAt ? null : (
                <ArchiveButton item={ref} archived={false} redirectTo="/areas" />
              )}
              <DeleteItemButton
                action={deleteArea.bind(null, area.id)}
                redirectTo="/areas"
                itemLabel="이 영역"
              />
            </>
          }
        >
          <AreaFields
            editorKey={area.id}
            tagSuggestions={allTags.map((t) => t.name)}
            values={{
              title: area.title,
              standard: area.standard,
              body: area.body,
              tags: area.tags,
            }}
          />
        </ItemForm>
      </div>
      <Section
        title={`프로젝트${countLabel(areaProjects.length)}`}
        action={
          areaProjects.length === 0 ? undefined : (
            <LinkButton href={`/projects/new?area=${area.id}`} variant="ghost" size="sm">
              새 프로젝트
            </LinkButton>
          )
        }
      >
        {areaProjects.length === 0 ? (
          <EmptyAdd href={`/projects/new?area=${area.id}`}>＋ 새 프로젝트</EmptyAdd>
        ) : (
          <ProjectStatusBoard groups={projectGroups} showGroupTitles={showGroupTitles} />
        )}
      </Section>
      {/* 목표 and 노트 side by side on wide screens; items-start keeps a short side short. */}
      <div className="grid items-start gap-x-8 gap-y-12 lg:grid-cols-2">
        <Section
          title={`목표${countLabel(goalOrder(areaGoals).length)}`}
          action={
            areaGoals.length === 0 ? undefined : (
              <LinkButton href={`/goals/new?area=${area.id}`} variant="ghost" size="sm">
                새 목표
              </LinkButton>
            )
          }
        >
          {areaGoals.length === 0 ? (
            <EmptyAdd href={`/goals/new?area=${area.id}`}>＋ 새 목표</EmptyAdd>
          ) : (
            <GoalTree nodes={areaGoals} />
          )}
        </Section>
        <ItemNotes owner={ref} archived={Boolean(area.archivedAt)} />
      </div>
      {materials.length === 0 ? null : (
        <Section title={`논문·세미나·생각 ${materials.length}`}>
          <RowList aria-label="연결된 자료">
            {materials.map((m) => (
              <li key={`${m.ref.type}:${m.ref.id}`}>
                <Link
                  href={`${ITEM_ROUTE[m.ref.type]}/${m.ref.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface"
                >
                  <Badge tone={ITEM_TYPE.tone(m.ref.type)}>{ITEM_TYPE.label(m.ref.type)}</Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                  <span className="max-w-72 shrink-0 truncate text-xs text-muted">
                    {viaLabel(m.via)}
                  </span>
                </Link>
              </li>
            ))}
          </RowList>
        </Section>
      )}
      <ConnectedWithGraph item={ref} />
    </Page>
  );
}

const countLabel = (n: number) => (n ? ` ${n}` : "");

/**
 * 계획·진행 중·완료·보류 columns, empty ones included. Cards keep the goal grouping:
 * within a column they follow goal order, and the first card of each goal names it.
 */
function ProjectStatusBoard({
  groups,
  showGroupTitles,
}: {
  groups: ProjectGroup<AreaProject>[];
  showGroupTitles: boolean;
}) {
  const ordered = groups.flatMap((g) => g.projects.map((p) => ({ ...p, group: g })));
  return (
    <ol
      aria-label="상태별 프로젝트"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {columnsByStatus(ordered).map((column) => (
        <KanbanColumn
          key={column.status}
          label={PROJECT_STATUS.label(column.status)}
          count={column.items.length}
        >
          {column.items.map((p, i) => {
            const newGroup = showGroupTitles && column.items[i - 1]?.group !== p.group;
            return (
              <div key={p.id} className="flex flex-col gap-1">
                {newGroup ? (
                  <h3 className="truncate px-1 text-xs text-muted">
                    {p.group.goalId ? `목표 ${p.group.title}` : "목표 없음"}
                  </h3>
                ) : null}
                <KanbanCard
                  project={p}
                  meta={
                    p.viaGoal ? (
                      // No area of its own: listed because its goal belongs to this area.
                      <span className="truncate text-xs text-muted">
                        {viaLabel([{ type: "goal", ...p.viaGoal }])}
                      </span>
                    ) : null
                  }
                />
              </div>
            );
          })}
        </KanbanColumn>
      ))}
    </ol>
  );
}
