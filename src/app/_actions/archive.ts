"use server";

import { revalidatePath } from "next/cache";
import { archive, RepoError } from "@/lib/repo";
import { parseItemRef } from "./parse";
import { runAction, type ActionResult } from "./result";

const NOT_FOUND = "항목을 찾을 수 없습니다.";

// Archiving changes lists, home, the inbox count in the sidebar and /archive.
const revalidateAll = () => revalidatePath("/", "layout");

/** Archives an item (4 types or an area): hidden from lists, home and the link picker. */
export async function archiveItem(ref: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!(await archive.archive(parseItemRef(ref)))) throw new RepoError("not_found", NOT_FOUND);
    revalidateAll();
    return null;
  });
}

export async function unarchiveItem(ref: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!(await archive.unarchive(parseItemRef(ref)))) throw new RepoError("not_found", NOT_FOUND);
    revalidateAll();
    return null;
  });
}
