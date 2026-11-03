"use server";

import { revalidatePath } from "next/cache";
import { RECOMMENDED_AREAS } from "@/lib/enums";
import { areas, RepoError } from "@/lib/repo";
import type { SkippedArea } from "@/lib/repo/areas";
import { parseAreaForm } from "./area-form";
import { optionalStringList, parseId } from "./parse";
import { runAction, type ActionResult } from "./result";

const NOT_FOUND = "영역을 찾을 수 없습니다.";

// Areas appear in the sidebar on every page, so refresh the whole layout.
const revalidateAll = () => revalidatePath("/", "layout");

/** FormData: `title`, `standard`, `body`, repeated `tags`. */
export async function createArea(form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const area = await areas.create(parseAreaForm(form));
    revalidateAll();
    return { id: area.id };
  });
}

export async function updateArea(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const areaId = parseId(id);
    if (!(await areas.update(areaId, parseAreaForm(form)))) {
      throw new RepoError("not_found", NOT_FOUND);
    }
    revalidateAll();
    return { id: areaId };
  });
}

/** Deletes the area; its projects remain without an area. */
export async function deleteArea(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!(await areas.remove(parseId(id)))) throw new RepoError("not_found", NOT_FOUND);
    revalidateAll();
    return null;
  });
}

/** Pins the area to the sidebar (`pinned: true`) or unpins it. */
export async function setAreaPinned(
  id: unknown,
  pinned: unknown,
): Promise<ActionResult<{ id: string; pinned: boolean }>> {
  return runAction(async () => {
    const areaId = parseId(id);
    if (typeof pinned !== "boolean") throw new RepoError("invalid", "고정 값이 올바르지 않습니다.");
    if (!(await areas.setPinned(areaId, pinned))) throw new RepoError("not_found", NOT_FOUND);
    revalidateAll();
    return { id: areaId, pinned };
  });
}

/** New order: every non-archived area id exactly once. */
export async function reorderAreas(ids: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!Array.isArray(ids)) throw new RepoError("invalid", "순서가 올바르지 않습니다.");
    await areas.reorder(ids.map((id) => parseId(id)));
    revalidateAll();
    return null;
  });
}

/**
 * Creates the chosen recommended areas (연구 분야·학위·건강·커리어) with their suggested
 * standards. Unknown names are rejected. Titles that already exist are skipped and
 * reported; `archived: true` means the user can restore it from the archive instead.
 * Created from the sidebar, they are pinned there right away.
 */
export async function createRecommendedAreas(
  names: unknown,
): Promise<ActionResult<{ ids: string[]; skipped: SkippedArea[] }>> {
  return runAction(async () => {
    const chosen = optionalStringList(names, "추천 영역", RECOMMENDED_AREAS.length) ?? [];
    const picks = RECOMMENDED_AREAS.filter((a) => chosen.includes(a.title));
    if (picks.length !== new Set(chosen).size || picks.length === 0) {
      throw new RepoError("invalid", "추천 영역을 골라 주세요.");
    }
    const { created, skipped } = await areas.createMissing(
      picks.map((a) => ({ title: a.title, standard: a.standard })),
    );
    for (const area of created) await areas.pin(area.id);
    revalidateAll();
    return { ids: created.map((a) => a.id), skipped };
  });
}
