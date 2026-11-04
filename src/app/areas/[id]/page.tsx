import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteArea } from "@/app/_actions/areas";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { DashboardAdd } from "@/components/dashboard/DashboardSection";
import { TaskSection } from "@/components/tasks/TaskSection";
import { Page } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Card";
import { isValidItemId } from "@/lib/ids";
import { ITEM_ROUTE, ITEM_TYPE } from "@/lib/enums";
import { areas, goals, projects, tags } from "@/lib/repo";
import type { AreaProject } from "@/lib/repo/projects";
import { GoalTree } from "../../goals/GoalTree";
import { ProgressBadge } from "../../projects/ProgressBadge";
import { updateAreaPatch } from "../actions";
import { AreaFields } from "../AreaFields";
import { goalOrder, groupProjectsByGoal, viaLabel } from "../flow";

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
        title={`목표${countLabel(goalOrder(areaGoals).length)}`}
        action={
          areaGoals.length === 0 ? undefined : (
            <Link href={`/goals/new?area=${area.id}`} className={buttonClass("ghost", "sm")}>
              새 목표
            </Link>
          )
        }
      >
        {areaGoals.length === 0 ? (
          <DashboardAdd href={`/goals/new?area=${area.id}`}>＋ 새 목표</DashboardAdd>
        ) : (
          <GoalTree nodes={areaGoals} />
        )}
      </Section>
      <Section
        title={`프로젝트${countLabel(areaProjects.length)}`}
        action={
          areaProjects.length === 0 ? undefined : (
            <Link href={`/projects/new?area=${area.id}`} className={buttonClass("ghost", "sm")}>
              새 프로젝트
            </Link>
          )
        }
      >
        {areaProjects.length === 0 ? (
          <DashboardAdd href={`/projects/new?area=${area.id}`}>＋ 새 프로젝트</DashboardAdd>
        ) : (
          <div className="flex flex-col gap-4">
            {projectGroups.map((group) => (
              <div key={group.goalId ?? "none"} className="flex flex-col gap-1.5">
                {showGroupTitles ? (
                  <h3 className="text-xs text-muted">
                    {group.goalId ? (
                      <>
                        목표{" "}
                        <Link href={`/goals/${group.goalId}`} className="text-fg hover:underline">
                          {group.title}
                        </Link>
                      </>
                    ) : (
                      "목표 없음"
                    )}
                  </h3>
                ) : null}
                <ProjectList list={group.projects} />
              </div>
            ))}
          </div>
        )}
      </Section>
      {materials.length === 0 ? null : (
        <Section title={`자료 ${materials.length}`}>
          <ul
            aria-label="연결된 자료"
            className="flex flex-col divide-y divide-border rounded-lg border border-border"
          >
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
          </ul>
        </Section>
      )}
      <TaskSection parent={ref} archived={Boolean(area.archivedAt)} />
      <ConnectedWithGraph item={ref} />
    </Page>
  );
}

const countLabel = (n: number) => (n ? ` ${n}` : "");

function ProjectList({ list }: { list: AreaProject[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {list.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}`}
            className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
            {p.viaGoal ? (
              // No area of its own: listed because its goal belongs to this area.
              <span className="max-w-48 shrink-0 truncate text-xs text-muted">
                {viaLabel([{ type: "goal", ...p.viaGoal }])}
              </span>
            ) : null}
            {p.nextAction ? (
              <span className="hidden max-w-64 truncate text-muted sm:inline">
                다음: {p.nextAction}
              </span>
            ) : null}
            <ProgressBadge project={p} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
