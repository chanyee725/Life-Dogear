import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { papers } from "@/db/schema";

/**
 * Stored PDF path of a paper: `undefined` when the paper does not exist, `null`
 * when it has no PDF. Reads one column, for the high-frequency progress route.
 */
export async function getPaperPdfPath(id: string): Promise<string | null | undefined> {
  const [row] = await getDb()
    .select({ pdfPath: papers.pdfPath })
    .from(papers)
    .where(eq(papers.id, id))
    .limit(1);
  return row ? row.pdfPath : undefined;
}
