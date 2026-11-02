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

export type StoredProgress = {
  page: number | null;
  scroll: number | null;
  totalPages: number | null;
  lastReadAt: string | null;
};

/**
 * Saved reading position of a paper that has a PDF; `undefined` when the paper
 * does not exist or has no PDF.
 */
export async function getPaperProgress(id: string): Promise<StoredProgress | undefined> {
  const [row] = await getDb()
    .select({
      pdfPath: papers.pdfPath,
      page: papers.lastPage,
      scroll: papers.lastScroll,
      totalPages: papers.totalPages,
      lastReadAt: papers.lastReadAt,
    })
    .from(papers)
    .where(eq(papers.id, id))
    .limit(1);
  if (!row?.pdfPath) return undefined;
  return {
    page: row.page,
    scroll: row.scroll,
    totalPages: row.totalPages,
    lastReadAt: row.lastReadAt,
  };
}
