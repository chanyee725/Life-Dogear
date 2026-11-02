import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteItemButton } from "@/components/fields/DeleteItemButton";
import { ItemForm } from "@/components/fields/ItemForm";
import { ConnectedItems } from "@/components/links";
import { Page } from "@/components/shell/PageHeader";
import { projects, tags } from "@/lib/repo";
import { deleteProject, updateProject } from "../actions";
import { ProjectFields } from "../ProjectFields";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await projects.get((await params).id);
  return { title: project?.title ?? "연구" };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const [project, allTags] = await Promise.all([projects.get(id), tags.listAll()]);
  if (!project) notFound();

  return (
    <Page className="flex flex-col gap-12">
      <ItemForm
        mode="edit"
        action={updateProject.bind(null, project.id)}
        basePath="/projects"
        backLabel="연구"
        actions={
          <DeleteItemButton
            action={deleteProject.bind(null, project.id)}
            redirectTo="/projects"
            itemLabel="이 연구"
          />
        }
      >
        <ProjectFields
          editorKey={project.id}
          tagSuggestions={allTags.map((t) => t.name)}
          values={{
            title: project.title,
            researchQuestion: project.researchQuestion,
            stage: project.stage,
            startDate: project.startDate,
            dueDate: project.dueDate,
            body: project.body,
            tags: project.tags,
          }}
        />
      </ItemForm>
      <ConnectedItems item={{ type: "project", id: project.id }} />
    </Page>
  );
}
