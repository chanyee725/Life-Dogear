/**
 * Highlights on a paper's PDF (page, selected text, colour, note, rects as page
 * fractions). Not exported from `./index` (1팀 file) — import `@/lib/repo/highlights`.
 */
import { asc, eq } from "drizzle-orm";
import { highlights, links, papers, thoughts } from "@/db/schema";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  isHighlightColor,
  normalizeHighlightText,
  parseStoredRects,
  sortHighlights,
  thoughtBodyFrom,
  thoughtTitleFrom,
  toHighlightColor,
  validateRects,
  type HighlightColor,
  type RatioRect,
} from "@/lib/highlights";
import { MAX_HIGHLIGHT_NOTE, MAX_HIGHLIGHT_TEXT, MAX_PAGE } from "@/lib/highlights/limits";
import { isValidItemId } from "@/lib/ids";
import { db, newId, nowIso, RepoError, serializeWrite, withTx, type Executor } from "./shared";

type HighlightRow = typeof highlights.$inferSelect;

export type Highlight = Omit<HighlightRow, "rects" | "color"> & {
  color: HighlightColor;
  rects: RatioRect[];
};

export type HighlightInput = {
  paperId: string;
  page: number;
  text: string;
  color?: HighlightColor;
  note?: string;
  rects?: RatioRect[];
};

export type HighlightPatch = { note?: string; color?: HighlightColor };

export { MAX_HIGHLIGHT_NOTE, MAX_HIGHLIGHT_TEXT, MAX_PAGE };

const invalid = (message: string) => new RepoError("invalid", message);

function toHighlight(row: HighlightRow): Highlight {
  return { ...row, color: toHighlightColor(row.color), rects: parseStoredRects(row.rects) };
}

function requireId(id: unknown, field: string): string {
  if (!isValidItemId(id)) throw invalid(`${field} id가 올바르지 않습니다.`);
  return id;
}

function requireNote(note: unknown): string {
  if (note === undefined || note === null) return "";
  if (typeof note !== "string") throw invalid("메모 값이 올바르지 않습니다.");
  if (note.length > MAX_HIGHLIGHT_NOTE) throw invalid("메모가 너무 깁니다.");
  return note.trim();
}

function requireColor(color: unknown): HighlightColor {
  if (color === undefined) return DEFAULT_HIGHLIGHT_COLOR;
  if (!isHighlightColor(color)) throw invalid("색상 값이 올바르지 않습니다.");
  return color;
}

/** The paper's page count (null when unknown), or undefined when the paper does not exist. */
async function paperPageCount(exec: Executor, id: string): Promise<number | null | undefined> {
  const [row] = await exec
    .select({ totalPages: papers.totalPages })
    .from(papers)
    .where(eq(papers.id, id))
    .limit(1);
  return row ? row.totalPages : undefined;
}

/** All highlights of a paper in reading order. */
export async function listByPaper(paperId: string): Promise<Highlight[]> {
  if (!isValidItemId(paperId)) return [];
  const rows = await db()
    .select()
    .from(highlights)
    .where(eq(highlights.paperId, paperId))
    .orderBy(asc(highlights.page), asc(highlights.createdAt));
  return sortHighlights(rows.map(toHighlight));
}

export async function get(id: string): Promise<Highlight | null> {
  if (!isValidItemId(id)) return null;
  const [row] = await db().select().from(highlights).where(eq(highlights.id, id));
  return row ? toHighlight(row) : null;
}

export async function create(input: HighlightInput): Promise<Highlight> {
  const paperId = requireId(input.paperId, "논문");
  if (!Number.isInteger(input.page) || input.page < 1 || input.page > MAX_PAGE) {
    throw invalid("쪽 번호가 올바르지 않습니다.");
  }
  if (typeof input.text !== "string" || input.text.length > MAX_HIGHLIGHT_TEXT) {
    throw invalid("선택한 텍스트가 너무 깁니다.");
  }
  const text = normalizeHighlightText(input.text);
  if (!text) throw invalid("하이라이트할 텍스트를 선택하세요.");
  const rects = validateRects(input.rects ?? []);
  if (!rects) throw invalid("하이라이트 위치 정보가 올바르지 않습니다.");

  const row: HighlightRow = {
    id: newId(),
    paperId,
    page: input.page,
    text,
    color: requireColor(input.color),
    note: requireNote(input.note),
    rects: JSON.stringify(rects),
    createdAt: nowIso(),
  };
  await withTx(async (tx) => {
    // FKs are not enforced on every connection, so check the paper explicitly.
    const totalPages = await paperPageCount(tx, paperId);
    if (totalPages === undefined) throw new RepoError("not_found", "논문을 찾을 수 없습니다.");
    // When the PDF's page count is known, the page must exist in it.
    if (totalPages !== null && totalPages > 0 && row.page > totalPages) {
      throw invalid("쪽 번호가 올바르지 않습니다.");
    }
    await tx.insert(highlights).values(row);
  });
  return toHighlight(row);
}

/** Changes the note and/or colour. Returns null when the highlight does not exist. */
export async function update(id: string, patch: HighlightPatch): Promise<Highlight | null> {
  if (!isValidItemId(id)) return null;
  const set: Partial<HighlightRow> = {};
  if (patch.note !== undefined) set.note = requireNote(patch.note);
  if (patch.color !== undefined) set.color = requireColor(patch.color);
  if (!Object.keys(set).length) return get(id);
  const [row] = await serializeWrite(() =>
    db().update(highlights).set(set).where(eq(highlights.id, id)).returning(),
  );
  return row ? toHighlight(row) : null;
}

export async function remove(id: string): Promise<boolean> {
  if (!isValidItemId(id)) return false;
  const deleted = await serializeWrite(() =>
    db().delete(highlights).where(eq(highlights.id, id)).returning({ id: highlights.id }),
  );
  return deleted.length > 0;
}

/**
 * "생각 만들기": creates a thought (`memo`, `seed` — same defaults as the home quick
 * input) quoting the highlight with its page and note, linked thought → paper, in
 * one transaction. Returns null when the highlight does not exist.
 */
export async function createThought(highlightId: string): Promise<{ thoughtId: string } | null> {
  if (!isValidItemId(highlightId)) return null;
  return withTx(async (tx) => {
    const [h] = await tx.select().from(highlights).where(eq(highlights.id, highlightId));
    if (!h) return null;
    const [paper] = await tx
      .select({ id: papers.id, title: papers.title })
      .from(papers)
      .where(eq(papers.id, h.paperId));
    if (!paper) throw new RepoError("not_found", "논문을 찾을 수 없습니다.");

    const now = nowIso();
    const thoughtId = newId();
    await tx.insert(thoughts).values({
      id: thoughtId,
      title: thoughtTitleFrom(h.text),
      kind: "memo",
      maturity: "seed",
      body: thoughtBodyFrom({ text: h.text, page: h.page, note: h.note, paperTitle: paper.title }),
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(links).values({
      id: newId(),
      sourceType: "thought",
      sourceId: thoughtId,
      targetType: "paper",
      targetId: paper.id,
      createdAt: now,
    });
    return { thoughtId };
  });
}
