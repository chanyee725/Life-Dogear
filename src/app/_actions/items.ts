"use server";

import { items } from "@/lib/repo";
import type { ItemSummary } from "@/lib/repo/items";
import { parseItemRef, parseText } from "./parse";
import { runAction, type ActionResult } from "./result";

/** Title search across all types for the link picker. */
export async function searchItemTitles(
  query: unknown,
  excludeRef?: unknown,
): Promise<ActionResult<ItemSummary[]>> {
  return runAction(async () => {
    const q = parseText(query ?? "", "검색어", 200);
    const exclude = excludeRef == null ? undefined : parseItemRef(excludeRef);
    return items.searchTitles(q, exclude, 20);
  });
}
