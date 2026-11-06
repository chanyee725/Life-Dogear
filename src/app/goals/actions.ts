"use server";

import { revalidatePath } from "next/cache";
import { formText, parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { goals, RepoError } from "@/lib/repo";
import { parseGoalForm } from "./form";

const NOT_FOUND = "목표를 찾을 수 없습니다.";

function revalidate(id?: string) {
  revalidatePath("/goals");
  // Project pages offer goals in a select; tag pages list goals.
  revalidatePath("/projects", "layout");
  revalidatePath("/tags", "layout");
  if (id) revalidatePath("/goals/[id]", "page");
}

export async function createGoal(form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const goal = await goals.create({
      ...parseGoalForm(form),
      title: formText(form, "title") ?? "",
    });
    revalidate();
    return { id: goal.id };
  });
}

/** Autosave update (patch semantics: only sent fields change). */
export async function updateGoal(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const goalId = parseId(id);
    if (!(await goals.update(goalId, parseGoalForm(form)))) {
      throw new RepoError("not_found", NOT_FOUND);
    }
    revalidate(goalId);
    return { id: goalId };
  });
}

/** Deletes the goal; child goals and projects stay without it. */
export async function deleteGoal(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const goalId = parseId(id);
    if (!(await goals.remove(goalId))) throw new RepoError("not_found", NOT_FOUND);
    revalidate(goalId);
    return null;
  });
}
