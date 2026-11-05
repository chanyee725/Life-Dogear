"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { RepoError } from "@/lib/repo";
import * as highlights from "@/lib/repo/highlights";
import type { Highlight } from "@/lib/repo/highlights";

const NOT_FOUND = "하이라이트를 찾을 수 없습니다.";

function revalidatePaper() {
  revalidatePath("/papers/[id]", "page");
  revalidatePath("/papers/[id]/read", "page");
}

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Saves a highlight made in the PDF viewer. Values are validated by the repo. */
export async function createHighlight(input: unknown): Promise<ActionResult<Highlight>> {
  return runAction(async () => {
    const v = asObject(input);
    const paperId = parseId(v.paperId, "논문");
    const created = await highlights.create({
      paperId,
      page: v.page as number,
      text: v.text as string,
      color: v.color as highlights.HighlightInput["color"],
      note: v.note as string | undefined,
      rects: v.rects as highlights.HighlightInput["rects"],
    });
    revalidatePaper();
    return created;
  });
}

/** Edits a highlight's note and/or colour. */
export async function updateHighlight(
  id: unknown,
  patch: unknown,
): Promise<ActionResult<Highlight>> {
  return runAction(async () => {
    const highlightId = parseId(id, "하이라이트");
    const v = asObject(patch);
    const updated = await highlights.update(highlightId, {
      note: v.note as string | undefined,
      color: v.color as highlights.HighlightPatch["color"],
    });
    if (!updated) throw new RepoError("not_found", NOT_FOUND);
    revalidatePaper();
    return updated;
  });
}

export async function deleteHighlight(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const highlightId = parseId(id, "하이라이트");
    const found = await highlights.get(highlightId);
    if (!found || !(await highlights.remove(highlightId))) {
      throw new RepoError("not_found", NOT_FOUND);
    }
    revalidatePaper();
    return undefined;
  });
}

/** "생각 만들기": thought from the highlight, linked to its paper. */
export async function createThoughtFromHighlight(
  id: unknown,
): Promise<ActionResult<{ thoughtId: string }>> {
  return runAction(async () => {
    const highlightId = parseId(id, "하이라이트");
    const found = await highlights.get(highlightId);
    if (!found) throw new RepoError("not_found", NOT_FOUND);
    const created = await highlights.createThought(highlightId);
    if (!created) throw new RepoError("not_found", NOT_FOUND);
    revalidatePaper();
    revalidatePath("/thoughts");
    revalidatePath("/");
    return created;
  });
}
