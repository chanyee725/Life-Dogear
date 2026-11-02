"use server";

import { revalidatePath } from "next/cache";
import { MAX_BODY, parseId } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import {
  appendLinerMemoEntry,
  LINER_MEMO_INPUT_MESSAGES,
  validateLinerMemoInput,
  type LinerMemoKind,
} from "@/lib/liner";
import { papers, RepoError } from "@/lib/repo";

export type LinerMemoInput = { kind: LinerMemoKind; text: string; sourceUrl?: string };

/**
 * Appends a pasted Liner answer/summary/highlight to the paper body's
 * "라이너 스콜라 메모" section (created if missing), stamped with today's date.
 * Returns the new body so an open editor can adopt it instead of overwriting it.
 */
export async function addLinerMemo(
  paperId: unknown,
  input: unknown,
): Promise<ActionResult<{ body: string }>> {
  return runAction(async () => {
    const id = parseId(paperId, "논문");
    const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const problem = validateLinerMemoInput({ kind: v.kind, text: v.text, sourceUrl: v.sourceUrl });
    if (problem) throw new RepoError("invalid", LINER_MEMO_INPUT_MESSAGES[problem]);

    const paper = await papers.get(id);
    if (!paper) throw new RepoError("not_found", "논문을 찾을 수 없습니다.");

    const body = appendLinerMemoEntry(paper.body, {
      kind: v.kind as LinerMemoKind,
      text: v.text as string,
      sourceUrl: typeof v.sourceUrl === "string" ? v.sourceUrl : undefined,
    });
    if (body.length > MAX_BODY)
      throw new RepoError("invalid", "본문이 너무 길어 저장할 수 없습니다.");

    const updated = await papers.update(id, { body });
    if (!updated) throw new RepoError("not_found", "논문을 찾을 수 없습니다.");
    revalidatePath(`/papers/${id}`);
    revalidatePath("/papers");
    return { body };
  });
}
