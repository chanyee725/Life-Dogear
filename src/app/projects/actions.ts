"use server";

import { revalidatePath } from "next/cache";
import { formText, parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { projects, RepoError } from "@/lib/repo";
import { parseProjectForm } from "./form";

function revalidate(id?: string) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/tags", "layout");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function createProject(form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    // A missing title is rejected by the repo ("제목을 입력하세요.").
    const project = await projects.create({
      ...parseProjectForm(form),
      title: formText(form, "title") ?? "",
    });
    revalidate();
    return { id: project.id };
  });
}

export async function updateProject(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const projectId = parseId(id);
    const updated = await projects.update(projectId, parseProjectForm(form));
    if (!updated) throw new RepoError("not_found", "연구를 찾을 수 없습니다.");
    revalidate(projectId);
    return { id: projectId };
  });
}

export async function deleteProject(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const projectId = parseId(id);
    if (!(await projects.remove(projectId)))
      throw new RepoError("not_found", "연구를 찾을 수 없습니다.");
    revalidate(projectId);
    return null;
  });
}
