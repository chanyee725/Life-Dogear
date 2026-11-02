import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedItems } from "@/components/links";
import { Page } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Card";
import { isValidItemId } from "@/lib/ids";
import { areas, goals, tags } from "@/lib/repo";
import { areaOptionsFor } from "../../projects/ProjectFields";
import { deleteGoal, updateGoal } from "../actions";
import { GoalFields } from "../GoalFields";
import { GoalProgress } from "../GoalProgress";
import { GoalTree } from "../GoalTree";
import { parentOptionsFor } from "../options";
import { goalLevelLabel } from "../period";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const goal = isValidItemId(id) ? await goals.get(id) : null;
  return { title: goal?.title ?? "목표" };
}

const CHILD_HORIZON = { life: "year", year: "quarter", quarter: null } as const;

export default async function GoalDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isValidItemId(id)) notFound();
  const [node, allTags, areaList, goalList] = await Promise.all([
    goals.getNode(id),
    tags.listAll({ visibleOnly: true }),
    areas.list({ includeArchived: true }),
    goals.list({ includeArchived: true }),
  ]);
  if (!node) notFound();
  const { goal } = node;
  const ref = { type: "goal" as const, id: goal.id };
  const childHorizon = CHILD_HORIZON[goal.horizon];

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {goal.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateGoal.bind(null, goal.id)}
          basePath="/goals"
          backLabel="목표"
          actions={
            <>
              {goal.archivedAt ? null : (
                <ArchiveButton item={ref} archived={false} redirectTo="/goals" />
              )}
              <DeleteItemButton
                action={deleteGoal.bind(null, goal.id)}
                redirectTo="/goals"
                itemLabel="이 목표"
              />
            </>
          }
        >
          <p className="-mb-3 flex items-center gap-3 text-[13px] text-muted">
            {goalLevelLabel(goal)}
            <GoalProgress value={node.progress} />
          </p>
          <GoalFields
            editorKey={goal.id}
            tagSuggestions={allTags.map((t) => t.name)}
            parentOptions={parentOptionsFor(goalList, goal.id, goal.parentId)}
            areaOptions={areaOptionsFor(areaList, goal.areaId)}
            values={{
              title: goal.title,
              horizon: goal.horizon,
              period: goal.period,
              parentId: goal.parentId,
              areaId: goal.areaId,
              why: goal.why,
              status: goal.status,
              progressMode: goal.progressMode,
              manualProgress: goal.manualProgress,
              body: goal.body,
              tags: goal.tags,
            }}
          />
        </ItemForm>
      </div>
      {childHorizon ? (
        <Section
          title={`하위 목표${node.children.length ? ` ${node.children.length}` : ""}`}
          action={
            <Link
              href={`/goals/new?horizon=${childHorizon}&parent=${goal.id}`}
              className={buttonClass("ghost", "sm")}
            >
              {childHorizon === "year" ? "새 연 목표" : "새 분기 목표"}
            </Link>
          }
        >
          {node.children.length ? (
            <GoalTree nodes={node.children} />
          ) : (
            <p className="text-sm text-muted">아직 하위 목표가 없습니다.</p>
          )}
        </Section>
      ) : null}
      {goal.horizon === "life" ? null : (
        <Section
          title={`프로젝트${node.projects.length ? ` ${node.projects.length}` : ""}`}
          action={
            <Link href={`/projects/new?goal=${goal.id}`} className={buttonClass("ghost", "sm")}>
              새 프로젝트
            </Link>
          }
        >
          {node.projects.length === 0 ? (
            <p className="text-sm text-muted">
              이 목표를 향하는 프로젝트가 없습니다. 프로젝트 화면에서 목표를 고르면 여기 보입니다.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {node.projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface"
                  >
                    <span
                      className={
                        p.done
                          ? "min-w-0 flex-1 truncate text-muted line-through"
                          : "min-w-0 flex-1 truncate font-medium"
                      }
                    >
                      {p.title}
                    </span>
                    <span className="text-xs text-muted">
                      {p.done ? "완료" : p.resourceCount ? `자료 ${p.resourceCount}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      <ConnectedItems item={ref} />
    </Page>
  );
}
