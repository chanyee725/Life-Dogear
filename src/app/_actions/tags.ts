"use server";

import { revalidatePath } from "next/cache";
import { ITEM_ROUTE } from "@/lib/enums";
import { tags } from "@/lib/repo";
import type { TagCount } from "@/lib/repo/tags";
import { itemPath, optionalStringList, parseItemRef } from "./parse";
import { runAction, type ActionResult } from "./result";

/** Replaces an item's tags; returns the normalized names. */
export async function setItemTags(ref: unknown, names: unknown): Promise<ActionResult<string[]>> {
  return runAction(async () => {
    const item = parseItemRef(ref);
    const list = optionalStringList(names, "태그") ?? [];
    const saved = await tags.setTags(item, list);
    revalidatePath(itemPath(item));
    revalidatePath(ITEM_ROUTE[item.type]);
    revalidatePath("/tags");
    revalidatePath("/");
    return saved;
  });
}

/** All tags in use with counts (tag input suggestions, tag filter). */
export async function listAllTags(): Promise<ActionResult<TagCount[]>> {
  return runAction(() => tags.listAll());
}
