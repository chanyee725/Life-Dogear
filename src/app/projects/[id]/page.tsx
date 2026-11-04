import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchiveButton, ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { ItemNotes } from "@/components/notes/ItemNotes";
import { seoulDate } from "@/components/calendar/model";
import { TaskSection } from "@/components/tasks/TaskSection";
import { Page } from "@/components/shell/PageHeader";
import { formatDate } from "@/components/ui";
import { isValidItemId } from "@/lib/ids";
import { areas, goals, projects, tags } from "@/lib/repo";
import { goalOptionsFor } from "../../goals/options";
import { deleteProject, updateProject } from "../actions";
import { areaOptionsFor, ProjectFields } from "../ProjectFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = isValidItemId(id) ? await projects.get(id) : null;
  return { title: project?.title ?? "프로젝트" };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isValidItemId(id)) notFound();
  const [project, allTags, areaList, goalList] = await Promise.all([
    projects.get(id),
    tags.listAll({ visibleOnly: true }),
    areas.list({ includeArchived: true }),
    goals.list({ includeArchived: true }),
  ]);
  if (!project) notFound();
  const ref = { type: "project" as const, id: project.id };

  return (
    <Page className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        {project.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateProject.bind(null, project.id)}
          basePath="/projects"
          backLabel="프로젝트"
          actions={
            <>
              {project.archivedAt ? null : (
                <ArchiveButton item={ref} archived={false} redirectTo="/projects" />
              )}
              <DeleteItemButton
                action={deleteProject.bind(null, project.id)}
                redirectTo="/projects"
                itemLabel="이 프로젝트"
              />
            </>
          }
        >
          <ProjectFields
            editorKey={project.id}
            created={formatDate(seoulDate(project.createdAt))}
            tagSuggestions={allTags.map((t) => t.name)}
            areaOptions={areaOptionsFor(areaList, project.areaId)}
            goalOptions={goalOptionsFor(goalList, project.goalId)}
            values={{
              title: project.title,
              kind: project.kind,
              stage: project.stage,
              status: project.status,
              areaId: project.areaId,
              goalId: project.goalId,
              nextAction: project.nextAction,
              researchQuestion: project.researchQuestion,
              startDate: project.startDate,
              dueDate: project.dueDate,
              body: project.body,
              tags: project.tags,
            }}
          />
        </ItemForm>
      </div>
      <ItemNotes owner={ref} archived={Boolean(project.archivedAt)} />
      <TaskSection parent={ref} archived={Boolean(project.archivedAt)} />
      <ConnectedWithGraph item={ref} />
    </Page>
  );
}
