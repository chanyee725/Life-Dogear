"use server";

import { revalidatePath } from "next/cache";
import { links, type ItemRef } from "@/lib/repo";
import { itemPath, parseItemRef } from "./parse";
import { runAction, type ActionResult } from "./result";

function revalidateBoth(a: ItemRef, b: ItemRef) {
  revalidatePath(itemPath(a));
  revalidatePath(itemPath(b));
  // Linking files a thought out of the inbox; the sidebar count lives in the layout.
  if (a.type === "thought" || b.type === "thought") revalidatePath("/", "layout");
}

/** Connects two items (idempotent). */
export async function linkItems(a: unknown, b: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const from = parseItemRef(a);
    const to = parseItemRef(b);
    await links.link(from, to);
    revalidateBoth(from, to);
    return undefined;
  });
}

/** Removes the connection between two items, whichever side created it. */
export async function unlinkItems(a: unknown, b: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const from = parseItemRef(a);
    const to = parseItemRef(b);
    await links.unlink(from, to);
    revalidateBoth(from, to);
    return undefined;
  });
}
