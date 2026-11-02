"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { RepoError, thoughts } from "@/lib/repo";
import { parseThoughtForm } from "./form";

function revalidate(id?: string) {
  revalidatePath("/");
  revalidatePath("/thoughts");
  revalidatePath("/tags", "layout");
  if (id) revalidatePath(`/thoughts/${id}`);
}

export async function createThought(form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const thought = await thoughts.create(parseThoughtForm(form));
    revalidate();
    return { id: thought.id };
  });
}

export async function updateThought(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const thoughtId = parseId(id);
    const updated = await thoughts.update(thoughtId, parseThoughtForm(form));
    if (!updated) throw new RepoError("not_found", "생각을 찾을 수 없습니다.");
    revalidate(thoughtId);
    return { id: thoughtId };
  });
}

export async function deleteThought(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const thoughtId = parseId(id);
    if (!(await thoughts.remove(thoughtId)))
      throw new RepoError("not_found", "생각을 찾을 수 없습니다.");
    revalidate(thoughtId);
    return null;
  });
}
