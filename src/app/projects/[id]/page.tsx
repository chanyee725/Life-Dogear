import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivedNotice } from "@/components/fields/ArchiveButton";
import { DetailMoreMenu } from "@/components/fields/DetailMoreMenu";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedWithGraph } from "@/components/graph/ConnectedWithGraph";
import { ItemNotes } from "@/components/notes/ItemNotes";
import { seoulDate } from "@/components/calendar/model";
import { TaskSection } from "@/components/tasks/TaskSection";
import { Page } from "@/components/shell/PageHeader";
import { formatDate } from "@/components/ui";
import { itemIdForMetadata, resolveItemRoute } from "@/lib/item-route";
import { areas, goals, projects, tags } from "@/lib/repo";
import { goalOptionsFor } from "../../goals/options";
import { deleteProject, updateProject } from "../actions";
import { areaOptionsFor, ProjectFields } from "../ProjectFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await itemIdForMetadata("projects", (await params).id);
  const project = id ? await projects.get(id) : null;
  return { title: project?.title ?? "프로젝트" };
}

export default async function ProjectDetailPage({ params }: Props) {
  const id = await resolveItemRoute("projects", (await params).id);
  const [project, allTags, areaList, goalList] = await Promise.all([
    projects.get(id),
    tags.listAll({ visibleOnly: true }),
    areas.list({ includeArchived: true }),
    goals.list({ includeArchived: true }),
  ]);
  if (!project) notFound();
  const ref = { type: "project" as const, id: project.id };

  return (
    <Page className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {project.archivedAt ? <ArchivedNotice item={ref} /> : null}
        <ItemForm
          mode="edit"
          action={updateProject.bind(null, project.id)}
          basePath="/projects"
          backLabel="프로젝트"
          actions={
            <>
              <DetailMoreMenu
                item={ref}
                archived={Boolean(project.archivedAt)}
                redirectTo="/projects"
                deleteAction={deleteProject.bind(null, project.id)}
                itemLabel="이 프로젝트"
              />
            </>
          }
        >
          <ProjectFields
            doc={{ type: "project", id: project.id }}
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
      <ItemNotes owner={ref} archived={Boolean(project.archivedAt)} taskParent={ref} />
      <TaskSection parent={ref} archived={Boolean(project.archivedAt)} />
      <ConnectedWithGraph item={ref} hideListedNotes />
    </Page>
  );
}
