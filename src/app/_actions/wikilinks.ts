"use server";

import { revalidatePath } from "next/cache";
import { items, links, RepoError, type ItemRef } from "@/lib/repo";
import type { ItemSummary } from "@/lib/repo/items";
import { cleanTitle, titleKey } from "@/lib/wikilinks";
import { itemRoute, MAX_TITLE, optionalStringList, parseItemRef, parseText } from "./parse";
import { runAction, type ActionResult } from "./result";

const MAX_TITLES = 200;

function requireWikiTitle(value: unknown, field = "제목"): string {
  const title = cleanTitle(parseText(value, field, MAX_TITLE));
  if (!title) throw new RepoError("invalid", "제목을 입력하세요.");
  return title;
}

/** `[[title]]` → item, keyed by `titleKey`; unknown titles are absent (shown gray). */
export async function resolveWikiTitles(
  titles: unknown,
): Promise<ActionResult<Record<string, ItemSummary>>> {
  return runAction(async () => {
    const list = optionalStringList(titles, "제목", MAX_TITLES) ?? [];
    return Object.fromEntries(await items.resolveTitles(list));
  });
}

/**
 * "생각으로 만들기" for a gray `[[title]]`: creates a thought with that title (or returns
 * the item that already has it) and links it from `source`'s saved body.
 */
export async function createThoughtForTitle(
  title: unknown,
  source?: unknown,
): Promise<ActionResult<{ ref: ItemRef }>> {
  return runAction(async () => {
    const wanted = requireWikiTitle(title);
    const from = source == null ? undefined : parseItemRef(source, "출처");
    const ref = await links.ensureTitledThought(wanted, from);
    if (from) revalidatePath(itemRoute(from), "page");
    revalidatePath("/thoughts");
    // The inbox count in the sidebar.
    revalidatePath("/", "layout");
    return { ref };
  });
}

/** Linked items whose body still says `[[oldTitle]]` for `item`. */
export async function countWikiMentions(
  item: unknown,
  oldTitle: unknown,
): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ref = parseItemRef(item);
    return { count: await links.countTitleMentions(ref, requireWikiTitle(oldTitle, "옛 제목")) };
  });
}

/** Rewrites `[[oldTitle]]` → `[[newTitle]]` in linked bodies, once the new title is saved. */
export async function renameWikiMentions(
  item: unknown,
  oldTitle: unknown,
  newTitle: unknown,
): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ref = parseItemRef(item);
    const from = requireWikiTitle(oldTitle, "옛 제목");
    const to = requireWikiTitle(newTitle, "새 제목");
    const saved = (await items.getTitles([ref])).get(items.refKey(ref));
    if (saved === undefined) throw new RepoError("not_found", "항목을 찾을 수 없습니다.");
    if (titleKey(saved) !== titleKey(to)) {
      throw new RepoError(
        "invalid",
        "새 제목이 아직 저장되지 않았습니다. 잠시 후 다시 시도하세요.",
      );
    }
    const changed = await links.renameTitleMentions(ref, from, saved);
    for (const r of changed) revalidatePath(itemRoute(r), "page");
    return { count: changed.length };
  });
}
