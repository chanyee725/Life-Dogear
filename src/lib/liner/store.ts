import "server-only";
import { eq } from "drizzle-orm";
import { papers } from "@/db/schema";
import { nowIso, withTx } from "@/lib/repo/shared";
import { appendLinerMemoEntry, type LinerMemoKind } from "./memo";

export type AppendLinerMemoResult =
  { ok: true; body: string } | { ok: false; reason: "not_found" | "too_long" };

/**
 * Reads the paper body, appends the memo and writes it back inside one serialized
 * write transaction, so two memos saved at the same time both survive (a separate
 * get → update would let the second write drop the first memo).
 * Input must already be validated. Kept out of `./index` so client code that
 * imports the pure memo helpers never pulls in the database.
 */
export function appendLinerMemoToPaper(
  paperId: string,
  input: { kind: LinerMemoKind; text: string; sourceUrl?: string },
  { maxBody, now = new Date() }: { maxBody: number; now?: Date },
): Promise<AppendLinerMemoResult> {
  return withTx(async (tx) => {
    const [row] = await tx.select({ body: papers.body }).from(papers).where(eq(papers.id, paperId));
    if (!row) return { ok: false, reason: "not_found" };

    const body = appendLinerMemoEntry(row.body, input, now);
    if (body.length > maxBody) return { ok: false, reason: "too_long" };

    await tx.update(papers).set({ body, updatedAt: nowIso() }).where(eq(papers.id, paperId));
    return { ok: true, body };
  });
}
