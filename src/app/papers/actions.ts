"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formText,
  MAX_BODY,
  MAX_TITLE,
  optionalEnum,
  optionalInt,
  optionalStringList,
  optionalText,
  parseId,
  parseText,
} from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { IMPORTANCE, READ_STATUS } from "@/lib/enums";
import { papers, RepoError } from "@/lib/repo";
import type { PaperPatch } from "@/lib/repo/papers";
import { deletePdf } from "@/lib/storage/pdf";
import { itemPath } from "@/lib/item-path";

const MAX_AUTHORS = 200;

function revalidatePaper(id?: string) {
  revalidatePath("/papers");
  revalidatePath("/");
  if (id) revalidatePath(`/papers/${id}`);
}

/** Authors come one per form field (or as an array); commas inside a name are kept. */
function parseAuthors(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new RepoError("invalid", "저자 값이 올바르지 않습니다.");
  return optionalStringList(
    value.flatMap((v) => (typeof v === "string" ? v.split("\n") : [v])),
    "저자",
    MAX_AUTHORS,
  );
}

/** Validates a patch coming from the client. Only listed fields are accepted. */
function parsePatch(input: unknown): PaperPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RepoError("invalid", "입력 값이 올바르지 않습니다.");
  }
  const v = input as Record<string, unknown>;
  return {
    title: v.title === undefined ? undefined : parseText(v.title, "제목", MAX_TITLE),
    authors: parseAuthors(v.authors),
    year: optionalInt(v.year, "연도"),
    venue: optionalText(v.venue, "학술지·학회"),
    doi: optionalText(v.doi, "DOI"),
    url: optionalText(v.url, "링크"),
    readStatus: optionalEnum(READ_STATUS, v.readStatus, "읽기 상태"),
    importance: optionalEnum(IMPORTANCE, v.importance, "중요도"),
    summary: optionalText(v.summary, "한 줄 요약"),
    body: optionalText(v.body, "본문", MAX_BODY),
  };
}

/** New-paper form (useActionState). Redirects to the detail page on success. */
export async function createPaper(
  _previous: ActionResult<{ id: string }> | null,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const patch = parsePatch({
      title: formText(form, "title") ?? "",
      authors: form.getAll("authors"),
      year: formText(form, "year"),
      venue: formText(form, "venue"),
      doi: formText(form, "doi"),
      url: formText(form, "url"),
      readStatus: formText(form, "readStatus") || undefined,
      importance: formText(form, "importance") || undefined,
      summary: formText(form, "summary"),
      body: formText(form, "body"),
    });
    const tags = optionalStringList(form.getAll("tags"), "태그") ?? [];
    const paper = await papers.create({ ...patch, title: patch.title ?? "", tags });
    revalidatePaper();
    return { id: paper.id, title: paper.title };
  });
  if (result.ok) redirect(itemPath("papers", result.data.id, result.data.title));
  return result;
}

/** Inline edits on the detail page (fields and body autosave). */
export async function updatePaper(id: unknown, patch: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const paperId = parseId(id, "논문");
    const updated = await papers.update(paperId, parsePatch(patch));
    if (!updated) throw new RepoError("not_found", "논문을 찾을 수 없습니다.");
    revalidatePaper(paperId);
    return undefined;
  });
}

/** Deletes the paper (with its highlights, links and tags) and its PDF file. */
export async function deletePaper(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const paperId = parseId(id, "논문");
    const { removed } = await papers.remove(paperId);
    if (!removed) throw new RepoError("not_found", "논문을 찾을 수 없습니다.");
    // The file path is derived from the id, never from the stored pdf_path.
    // The paper is already gone, so a leftover file is only logged.
    await deletePdf(paperId).catch((error: unknown) => {
      console.error("[papers] PDF cleanup failed", error instanceof Error ? error.name : "unknown");
    });
    revalidatePaper(paperId);
    return undefined;
  });
}
