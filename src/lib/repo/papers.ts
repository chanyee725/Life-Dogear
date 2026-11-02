import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { highlights, papers } from "@/db/schema";
import { IMPORTANCE, READ_STATUS, type Importance, type ReadStatus } from "@/lib/enums";
import { PAPER_TEMPLATE } from "@/lib/templates";
import { removeLinksFor } from "./links";
import {
  db,
  definedOnly,
  descNullsLast,
  hasTag,
  newId,
  nowIso,
  RepoError,
  requireEnum,
  requireTitle,
  trimText,
  type Executor,
  orderFor,
  withTx,
  serializeWrite,
} from "./shared";
import { getTagsFor, removeTagsFor, setTagsWith } from "./tags";

type PaperRow = typeof papers.$inferSelect;
export type Paper = Omit<PaperRow, "authors"> & { authors: string[]; tags: string[] };

export type PaperInput = {
  title: string;
  authors?: string[];
  year?: number | null;
  venue?: string;
  doi?: string;
  url?: string;
  readStatus?: ReadStatus;
  importance?: Importance;
  summary?: string;
  /** Defaults to the paper template on create. */
  body?: string;
  tags?: string[];
};
export type PaperPatch = Partial<PaperInput>;

export type PaperSort = "updated" | "created" | "title" | "year" | "lastRead";
export type PaperListOptions = {
  tag?: string;
  status?: ReadStatus;
  importance?: Importance;
  sort?: PaperSort;
};

export type ReadingProgress = { page: number; scroll: number; totalPages?: number | null };

const ORDER: Record<PaperSort, SQL[]> = {
  updated: [desc(papers.updatedAt)],
  created: [desc(papers.createdAt)],
  title: [asc(papers.title)],
  year: [descNullsLast(papers.year), asc(papers.title)],
  lastRead: [descNullsLast(papers.lastReadAt), desc(papers.updatedAt)],
};

const ref = (id: string) => ({ type: "paper" as const, id });

function parseAuthors(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

async function withTags(rows: PaperRow[], exec: Executor = db()): Promise<Paper[]> {
  const tagMap = await getTagsFor(
    "paper",
    rows.map((r) => r.id),
    exec,
  );
  return rows.map((r) => ({
    ...r,
    authors: parseAuthors(r.authors),
    tags: tagMap.get(r.id) ?? [],
  }));
}

function optionalYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RepoError("invalid", "연도 형식이 올바르지 않습니다.");
  }
  return year;
}

function toColumns(input: PaperPatch) {
  return definedOnly({
    title: input.title === undefined ? undefined : requireTitle(input.title),
    authors:
      input.authors === undefined
        ? undefined
        : JSON.stringify(input.authors.map((a) => a.trim()).filter(Boolean)),
    year: input.year === undefined ? undefined : optionalYear(input.year),
    venue: input.venue === undefined ? undefined : trimText(input.venue),
    doi: input.doi === undefined ? undefined : trimText(input.doi),
    url: input.url === undefined ? undefined : trimText(input.url),
    readStatus:
      input.readStatus === undefined
        ? undefined
        : requireEnum(READ_STATUS, input.readStatus, "읽기 상태"),
    importance:
      input.importance === undefined
        ? undefined
        : requireEnum(IMPORTANCE, input.importance, "중요도"),
    summary: input.summary === undefined ? undefined : trimText(input.summary),
    body: input.body,
  });
}

export async function list(options: PaperListOptions = {}): Promise<Paper[]> {
  const where: SQL[] = [];
  if (options.status) where.push(eq(papers.readStatus, options.status));
  if (options.importance) where.push(eq(papers.importance, options.importance));
  if (options.tag) where.push(hasTag(db(), "paper", papers.id, options.tag));
  const rows = await db()
    .select()
    .from(papers)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...orderFor(ORDER, options.sort, "updated"));
  return withTags(rows);
}

export async function get(id: string): Promise<Paper | null> {
  const [row] = await db().select().from(papers).where(eq(papers.id, id));
  return row ? (await withTags([row]))[0] : null;
}

export async function create(input: PaperInput): Promise<Paper> {
  const now = nowIso();
  const id = newId();
  await withTx(async (tx) => {
    await tx.insert(papers).values({
      id,
      title: requireTitle(input.title),
      body: PAPER_TEMPLATE,
      ...toColumns({ ...input, title: undefined, tags: undefined }),
      createdAt: now,
      updatedAt: now,
    });
    if (input.tags) await setTagsWith(tx, ref(id), input.tags);
  });
  return (await get(id))!;
}

export async function update(id: string, patch: PaperPatch): Promise<Paper | null> {
  const found = await withTx(async (tx) => {
    const updated = await tx
      .update(papers)
      .set({ ...toColumns({ ...patch, tags: undefined }), updatedAt: nowIso() })
      .where(eq(papers.id, id))
      .returning({ id: papers.id });
    if (!updated.length) return false;
    if (patch.tags) await setTagsWith(tx, ref(id), patch.tags);
    return true;
  });
  return found ? get(id) : null;
}

/**
 * Deletes the paper with its highlights, links and tags. Returns the stored
 * `pdfPath` so the caller can delete the file (storage lives outside the repo).
 */
export async function remove(id: string): Promise<{ removed: boolean; pdfPath: string | null }> {
  return withTx(async (tx) => {
    const deleted = await tx
      .delete(papers)
      .where(eq(papers.id, id))
      .returning({ pdfPath: papers.pdfPath });
    if (!deleted.length) return { removed: false, pdfPath: null };
    await tx.delete(highlights).where(eq(highlights.paperId, id));
    await removeLinksFor(tx, ref(id));
    await removeTagsFor(tx, ref(id));
    return { removed: true, pdfPath: deleted[0].pdfPath };
  });
}

/**
 * Attaches (or with `null`, detaches) the PDF. Reading position is reset since it
 * belonged to the previous file. Returns the previous path, or undefined if not found.
 */
export async function setPdf(
  id: string,
  path: string | null,
  totalPages?: number | null,
): Promise<{ previousPdfPath: string | null } | undefined> {
  return withTx(async (tx) => {
    const [before] = await tx
      .select({ pdfPath: papers.pdfPath })
      .from(papers)
      .where(eq(papers.id, id));
    if (!before) return undefined;
    await tx
      .update(papers)
      .set({
        pdfPath: path,
        totalPages: path ? (totalPages ?? null) : null,
        lastPage: null,
        lastScroll: null,
        updatedAt: nowIso(),
      })
      .where(eq(papers.id, id));
    return { previousPdfPath: before.pdfPath };
  });
}

/**
 * Saves the reading position. Moves `to_read` papers to `reading` and stamps
 * `lastReadAt`; does not touch `updatedAt` (reading is not editing).
 * Single UPDATE (no transaction) so frequent viewer saves stay cheap.
 */
export async function saveProgress(id: string, progress: ReadingProgress): Promise<boolean> {
  const totalPages =
    progress.totalPages != null && Number.isFinite(progress.totalPages) && progress.totalPages > 0
      ? Math.floor(progress.totalPages)
      : undefined;
  let page = Number.isFinite(progress.page) ? Math.max(1, Math.floor(progress.page)) : 1;
  if (totalPages) page = Math.min(page, totalPages);
  const scroll = Number.isFinite(progress.scroll) ? Math.min(1, Math.max(0, progress.scroll)) : 0;

  const updated = await serializeWrite(() =>
    db()
      .update(papers)
      .set({
        // Without a fresh page count, clamp to the stored one.
        lastPage: totalPages ? page : sql`min(${page}, coalesce(${papers.totalPages}, ${page}))`,
        lastScroll: scroll,
        ...(totalPages ? { totalPages } : {}),
        lastReadAt: nowIso(),
        readStatus: sql`case when ${papers.readStatus} = 'to_read' then 'reading' else ${papers.readStatus} end`,
      })
      .where(eq(papers.id, id))
      .returning({ id: papers.id }),
  );
  return updated.length > 0;
}

/** Papers being read, most recently read first (home "이어 읽기"). */
export async function listContinueReading(limit = 6): Promise<Paper[]> {
  const rows = await db()
    .select()
    .from(papers)
    .where(eq(papers.readStatus, "reading"))
    .orderBy(...ORDER.lastRead)
    .limit(limit);
  return withTags(rows);
}
