"use server";

import { revalidatePath } from "next/cache";
import { RepoError, thoughts } from "@/lib/repo";
import { formText, MAX_BODY } from "./parse";
import { runAction, type ActionResult } from "./result";

const MAX_TITLE_FROM_INPUT = 200;

/**
 * Home quick input: Enter saves a thought (`memo`, `seed`). The first line becomes
 * the title; anything after it (or past 200 chars) goes into the body.
 * Accepts a FormData with `title` or a plain string.
 */
export async function createQuickThought(
  input: FormData | string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const raw = typeof input === "string" ? input : (formText(input, "title") ?? "");
    if (typeof raw !== "string" || raw.length > MAX_BODY) {
      throw new RepoError("invalid", "내용이 올바르지 않습니다.");
    }
    const text = raw.trim();
    if (!text) throw new RepoError("invalid", "내용을 입력하세요.");

    const [firstLine, ...rest] = text.split(/\r?\n/);
    let title = firstLine.trim();
    let body = rest.join("\n").trim();
    if (title.length > MAX_TITLE_FROM_INPUT) {
      body = [title, body].filter(Boolean).join("\n\n");
      title = `${title.slice(0, MAX_TITLE_FROM_INPUT)}…`;
    }

    const thought = await thoughts.create({ title, body, kind: "memo", maturity: "seed" });
    revalidatePath("/");
    revalidatePath("/thoughts");
    return { id: thought.id };
  });
}
