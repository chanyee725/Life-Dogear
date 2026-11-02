"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { areas, RepoError } from "@/lib/repo";
import { parseAreaPatch } from "./form";

/**
 * Autosave update for the area detail page (patch semantics: only sent fields change).
 * Create, delete and reorder use the shared actions in `@/app/_actions/areas`.
 */
export async function updateAreaPatch(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const areaId = parseId(id);
    if (!(await areas.update(areaId, parseAreaPatch(form)))) {
      throw new RepoError("not_found", "영역을 찾을 수 없습니다.");
    }
    // Area titles appear in the sidebar on every page.
    revalidatePath("/", "layout");
    return { id: areaId };
  });
}
