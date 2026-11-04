"use server";

import { revalidatePath } from "next/cache";
import { items, links, notes, RepoError, type ItemRef } from "@/lib/repo";
import { cleanTitle } from "@/lib/wikilinks";
import { itemPath, MAX_TITLE, parseItemRef, parseText } from "./parse";
import { runAction, type ActionResult } from "./result";

/**
 * The editor's `/` → 페이지: creates a note titled `title` and ties it to `source`, the
 * document being edited. An area files the note under it (`area_id`); any other item gets
 * a link. Returns the saved title, which the editor inserts as `[[title]]`.
 */
export async function createSlashPage(
  title: unknown,
  source: unknown,
): Promise<ActionResult<{ ref: ItemRef; title: string }>> {
  return runAction(async () => {
    const wanted = cleanTitle(parseText(title, "제목", MAX_TITLE));
    if (!wanted) throw new RepoError("invalid", "제목을 입력하세요.");
    const from = parseItemRef(source, "문서");
    if (!(await items.getTitles([from])).has(items.refKey(from))) {
      throw new RepoError("not_found", "문서를 찾을 수 없습니다.");
    }

    const note = await notes.create({
      title: wanted,
      areaId: from.type === "area" ? from.id : undefined,
    });
    const ref: ItemRef = { type: "note", id: note.id };
    if (from.type !== "area") {
      try {
        await links.link(from, ref);
      } catch (error) {
        await notes.remove(note.id);
        throw error;
      }
    }

    revalidatePath(itemPath(from));
    revalidatePath(itemPath(ref));
    revalidatePath("/notes");
    if (from.type === "area") revalidatePath("/areas", "layout");
    return { ref, title: note.title };
  });
}
