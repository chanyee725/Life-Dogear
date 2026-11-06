"use server";

import { revalidatePath } from "next/cache";
import { items, links, notes, RepoError, type ItemRef } from "@/lib/repo";
import { cleanTitle, titleKey } from "@/lib/wikilinks";
import { itemRoute, MAX_TITLE, parseItemRef, parseText } from "./parse";
import { runAction, type ActionResult } from "./result";

/**
 * The editor's `/` → 페이지: ties a page titled `title` to `source`, the document being
 * edited, and returns the title the editor inserts as `[[title]]`. When an item already
 * has that title it is linked instead of creating a duplicate; otherwise a new note is
 * created and linked in one transaction (an area also files it under itself, `area_id`).
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

    const existing = (await items.resolveTitles([wanted])).get(titleKey(wanted));
    let page: { ref: ItemRef; title: string };
    if (existing) {
      // `[[this document's own title]]` needs no link.
      if (items.refKey(existing.ref) !== items.refKey(from)) await links.link(from, existing.ref);
      page = { ref: existing.ref, title: existing.title };
    } else {
      const note = await notes.create({
        title: wanted,
        areaId: from.type === "area" ? from.id : undefined,
        linkTo: from,
      });
      page = { ref: { type: "note", id: note.id }, title: note.title };
    }

    revalidatePath(itemRoute(from), "page");
    revalidatePath(itemRoute(page.ref), "page");
    revalidatePath("/notes");
    if (from.type === "area") revalidatePath("/areas", "layout");
    return page;
  });
}
