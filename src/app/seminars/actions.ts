"use server";

import { revalidatePath } from "next/cache";
import { formText, parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { RepoError, seminars } from "@/lib/repo";
import { parseSeminarForm } from "./form";

function revalidate(id?: string) {
  revalidatePath("/");
  revalidatePath("/seminars");
  revalidatePath("/tags", "layout");
  if (id) revalidatePath(`/seminars/${id}`);
}

export async function createSeminar(form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    // A missing title is rejected by the repo ("제목을 입력하세요.").
    const seminar = await seminars.create({
      ...parseSeminarForm(form),
      title: formText(form, "title") ?? "",
    });
    revalidate();
    return { id: seminar.id };
  });
}

export async function updateSeminar(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const seminarId = parseId(id);
    const updated = await seminars.update(seminarId, parseSeminarForm(form));
    if (!updated) throw new RepoError("not_found", "활동을 찾을 수 없습니다.");
    revalidate(seminarId);
    return { id: seminarId };
  });
}

export async function deleteSeminar(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const seminarId = parseId(id);
    if (!(await seminars.remove(seminarId)))
      throw new RepoError("not_found", "활동을 찾을 수 없습니다.");
    revalidate(seminarId);
    return null;
  });
}
