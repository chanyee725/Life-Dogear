"use server";

import { revalidatePath } from "next/cache";
import { formText, parseId, parseItemRef } from "@/app/_actions/parse";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { ITEM_ROUTE } from "@/lib/enums";
import { notes, RepoError, type ItemRef } from "@/lib/repo";
import { parseNoteForm } from "./form";

const NOT_FOUND = "노트를 찾을 수 없습니다.";

function revalidate(id?: string) {
  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/resources");
  revalidatePath("/areas", "layout");
  revalidatePath("/tags", "layout");
  if (id) revalidatePath(`/notes/${id}`);
}

export async function createNote(form: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    // A missing title is rejected by the repo ("제목을 입력하세요.").
    const linkTo = linkFromForm(form);
    const note = await notes.create({
      ...parseNoteForm(form),
      title: formText(form, "title") ?? "",
      linkTo,
    });
    revalidate();
    if (linkTo) revalidatePath(`${ITEM_ROUTE[linkTo.type]}/${linkTo.id}`);
    return { id: note.id };
  });
}

/** `/notes/new?project=…` / `?goal=…` carry the item to link as hidden `linkType`/`linkId`. */
function linkFromForm(form: FormData): ItemRef | undefined {
  const type = formText(form, "linkType");
  const id = formText(form, "linkId");
  if (!type && !id) return undefined;
  const ref = parseItemRef({ type, id }, "연결할 항목");
  if (ref.type !== "project" && ref.type !== "goal") {
    throw new RepoError("invalid", "연결할 항목 값이 올바르지 않습니다.");
  }
  return ref;
}

export async function updateNote(
  id: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const noteId = parseId(id);
    const updated = await notes.update(noteId, parseNoteForm(form));
    if (!updated) throw new RepoError("not_found", NOT_FOUND);
    revalidate(noteId);
    return { id: noteId };
  });
}

export async function deleteNote(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const noteId = parseId(id);
    if (!(await notes.remove(noteId))) throw new RepoError("not_found", NOT_FOUND);
    revalidate(noteId);
    return null;
  });
}
