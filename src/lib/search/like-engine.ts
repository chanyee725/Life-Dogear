import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db/client";
import {
  areas,
  goals,
  highlights,
  notes,
  papers,
  projects,
  reviews,
  seminars,
  tasks,
  thoughts,
} from "@/db/schema";
import type { ItemType } from "@/lib/enums";
import { parseStoredRects, readerHref, scrollTargetFor } from "@/lib/highlights";
import {
  compareHits,
  FIELD_SCORE,
  findMatch,
  itemHref,
  likePatterns,
  makeSnippet,
  plainText,
  sqlQueryForms,
  titleScore,
  type RankedHit,
} from "./text";
import type { SearchEngine, SearchField, Snippet } from "./types";

/**
 * Rows fetched per source before ranking in JS. Title matches are fetched first, so
 * the cap only drops lower-ranked rows; the palette shows at most 50 results anyway.
 */
export const CANDIDATES_PER_SOURCE = 50;
/** Characters of body fetched on each side of the first match (snippet uses 30/60). */
const BODY_WINDOW = 150;

type Source = {
  type: ItemType;
  table:
    | typeof projects
    | typeof areas
    | typeof papers
    | typeof seminars
    | typeof thoughts
    | typeof notes
    | typeof goals
    | typeof reviews;
  title: SQLiteColumn;
  /** Short fields (authors, summary, key line…) ranked between title and body. */
  meta: SQLiteColumn[];
  /**
   * SQL text matched for each `meta` column (same order). Usually the column itself;
   * JSON columns are matched without their delimiters so `"`, `,` or `[` do not hit
   * every row (see `jsonListText`).
   */
  metaMatch?: SQL[];
  body: SQLiteColumn;
  updatedAt: SQLiteColumn;
  /** Archived rows are still searched; the hit carries `archived` for a badge. */
  archivedAt: SQLiteColumn;
};

/**
 * A JSON string array (`["A","B"]`, as written by the repo) as plain "A, B" — the same
 * text `metaText` shows — so LIKE never matches the JSON quotes, commas or brackets.
 * Then the two escapes `JSON.stringify` writes in names are undone, so `"Q"` and `C\D`
 * are found: `\\` is parked as char(1) first so `\\"` (backslash, then a closing quote)
 * is not misread as `\"`. Rarer cases (a name containing `"]` or `","`, control-character
 * escapes) can still miss; a missed SQL candidate is not recovered by the JS re-check.
 */
function jsonListText(col: SQLiteColumn): SQL {
  const plain = sql`replace(replace(replace(${col}, '","', ', '), '["', ''), '"]', '')`;
  const unescaped = sql`replace(replace(replace(${plain}, '\\\\', char(1)), '\\"', '"'), char(1), '\\')`;
  return sql`case when ${col} = '[]' then '' else ${unescaped} end`;
}

const SOURCES: Source[] = [
  {
    type: "project",
    table: projects,
    title: projects.title,
    // Not `nextAction`: it is hidden, so it must not show up in snippets.
    meta: [projects.researchQuestion],
    body: projects.body,
    updatedAt: projects.updatedAt,
    archivedAt: projects.archivedAt,
  },
  {
    type: "area",
    table: areas,
    title: areas.title,
    meta: [areas.standard],
    body: areas.body,
    updatedAt: areas.updatedAt,
    archivedAt: areas.archivedAt,
  },
  {
    type: "paper",
    table: papers,
    title: papers.title,
    meta: [papers.authors, papers.summary, papers.venue],
    metaMatch: [jsonListText(papers.authors), sql`${papers.summary}`, sql`${papers.venue}`],
    body: papers.body,
    updatedAt: papers.updatedAt,
    archivedAt: papers.archivedAt,
  },
  {
    type: "seminar",
    table: seminars,
    title: seminars.title,
    meta: [seminars.keyLine, seminars.speaker, seminars.hostVenue],
    body: seminars.body,
    updatedAt: seminars.updatedAt,
    archivedAt: seminars.archivedAt,
  },
  {
    type: "thought",
    table: thoughts,
    title: thoughts.title,
    meta: [],
    body: thoughts.body,
    updatedAt: thoughts.updatedAt,
    archivedAt: thoughts.archivedAt,
  },
  {
    type: "note",
    table: notes,
    title: notes.title,
    // 출처 이름 (book, lecture… title); null when not given.
    meta: [notes.sourceTitle],
    body: notes.body,
    updatedAt: notes.updatedAt,
    archivedAt: notes.archivedAt,
  },
  {
    type: "goal",
    table: goals,
    title: goals.title,
    // "왜" — the one-line reason shown under the goal title.
    meta: [goals.why],
    body: goals.body,
    updatedAt: goals.updatedAt,
    archivedAt: goals.archivedAt,
  },
  {
    type: "review",
    table: reviews,
    title: reviews.title,
    meta: [],
    body: reviews.body,
    updatedAt: reviews.updatedAt,
    archivedAt: reviews.archivedAt,
  },
];

/** Expressions the short fields are matched on. */
const metaMatch = (source: Source): (SQL | SQLiteColumn)[] => source.metaMatch ?? source.meta;

const likeAny = (cols: (SQLiteColumn | SQL)[], patterns: string[]): SQL =>
  or(
    ...cols.flatMap((col) => patterns.map((p) => sql`lower(${col}) like ${p} escape '\\'`)),
  ) as SQL;

/** `authors` is a JSON array; match and show it as "A, B". */
function metaText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (!value.startsWith("[")) return value;
  try {
    const list: unknown = JSON.parse(value);
    return Array.isArray(list) ? list.filter((a) => typeof a === "string").join(", ") : value;
  } catch {
    return value;
  }
}

type Match = { field: SearchField; snippet: Snippet | null; score: number };

/** Best field match for an item row, or null when nothing really matches. */
function matchItem(title: string, meta: string[], body: string, query: string): Match | null {
  const t = titleScore(title, query);
  if (t > 0) return { field: "title", snippet: null, score: t };
  for (const text of meta) {
    if (findMatch(text, query) >= 0) {
      return { field: "meta", snippet: makeSnippet(text, query), score: FIELD_SCORE.meta };
    }
  }
  const plain = plainText(body);
  if (findMatch(plain, query) >= 0 || findMatch(body, query) >= 0) {
    return { field: "body", snippet: makeSnippet(plain, query), score: FIELD_SCORE.body };
  }
  return null;
}

/**
 * Only a window of the body around its first match, and nothing when the title or a
 * key field already matched (the body is not shown then). Keeps long notes out of
 * the result set. `instr`/`substr` count characters, as the window size does.
 */
function bodyWindow(source: Source, query: string, patterns: string[]): SQL {
  const lowered = sql`lower(${source.body})`;
  const positions = sqlQueryForms(query).map((f) => sql`nullif(instr(${lowered}, ${f}), 0)`);
  const at = sql`coalesce(${sql.join(positions, sql`, `)}, 1)`;
  const span = BODY_WINDOW * 2 + Math.max(...sqlQueryForms(query).map((f) => [...f].length));
  const shortHit = likeAny([source.title, ...metaMatch(source)], patterns);
  return sql`case when ${shortHit} then '' else substr(${source.body}, max(1, ${at} - ${BODY_WINDOW}), ${span}) end`;
}

/** A selected item row; short fields come back as `m0`, `m1`, … in `Source.meta` order. */
type ItemRow = {
  id: string;
  title: string;
  body: string | null;
  updatedAt: string;
  archivedAt: string | null;
  [meta: `m${number}`]: string;
};

async function searchItems(source: Source, query: string, patterns: string[]) {
  const { table, type } = source;
  const titleHit = likeAny([source.title], patterns);
  const rows = await getDb()
    .select({
      id: sql<string>`${table.id}`,
      title: sql<string>`${source.title}`,
      body: sql<string>`${bodyWindow(source, query, patterns)}`,
      updatedAt: sql<string>`${source.updatedAt}`,
      archivedAt: sql<string | null>`${source.archivedAt}`,
      ...Object.fromEntries(source.meta.map((col, i) => [`m${i}`, sql<string>`${col}`])),
    })
    .from(table)
    .where(likeAny([source.title, ...metaMatch(source), source.body], patterns))
    // Title matches first so they survive the candidate cap.
    .orderBy(sql`case when ${titleHit} then 0 else 1 end`, desc(source.updatedAt))
    .limit(CANDIDATES_PER_SOURCE);

  const hits: RankedHit[] = [];
  for (const row of rows as ItemRow[]) {
    const meta = source.meta.map((_, i) => metaText(row[`m${i}`]));
    const m = matchItem(row.title, meta, row.body ?? "", query);
    if (!m) continue;
    hits.push({
      type,
      id: row.id,
      title: row.title,
      snippet: m.snippet,
      field: m.field,
      href: itemHref(type, row.id, row.title),
      score: m.score,
      archived: row.archivedAt != null,
      updatedAt: row.updatedAt,
    });
  }
  return hits;
}

async function searchHighlights(query: string, patterns: string[]) {
  const rows = await getDb()
    .select({
      id: highlights.id,
      paperId: highlights.paperId,
      page: highlights.page,
      text: highlights.text,
      note: highlights.note,
      rects: highlights.rects,
      createdAt: highlights.createdAt,
      paperTitle: papers.title,
      paperArchivedAt: papers.archivedAt,
    })
    .from(highlights)
    .innerJoin(papers, eq(papers.id, highlights.paperId))
    .where(likeAny([highlights.text, highlights.note], patterns))
    .orderBy(desc(highlights.createdAt))
    .limit(CANDIDATES_PER_SOURCE);

  const hits: RankedHit[] = [];
  for (const r of rows) {
    const inText = findMatch(r.text, query) >= 0;
    if (!inText && findMatch(r.note, query) < 0) continue;
    const field: SearchField = inText ? "highlight" : "note";
    hits.push({
      type: "highlight",
      id: r.id,
      title: r.paperTitle,
      snippet: makeSnippet(inText ? r.text : r.note, query),
      field,
      // Straight to the highlighted spot, not just the top of its page.
      href: readerHref(r.paperId, r.page, scrollTargetFor(parseStoredRects(r.rects))),
      paperId: r.paperId,
      page: r.page,
      score: FIELD_SCORE[field],
      // A highlight has no archive state of its own; it follows its paper.
      archived: r.paperArchivedAt != null,
      updatedAt: r.createdAt,
    });
  }
  return hits;
}

/**
 * Tasks by title (one query; the parent's title and archive state come from left joins).
 * A task of an archived parent is still found and marked archived, like archived items.
 */
async function searchTasks(query: string, patterns: string[]) {
  const ofType = (type: "project" | "goal" | "area", id: SQLiteColumn) =>
    and(eq(tasks.parentType, type), eq(tasks.parentId, id));
  const rows = await getDb()
    .select({
      id: tasks.id,
      title: tasks.title,
      parentType: tasks.parentType,
      parentId: tasks.parentId,
      updatedAt: tasks.updatedAt,
      parentTitle: sql<string | null>`coalesce(${projects.title}, ${goals.title}, ${areas.title})`,
      parentArchived: sql<
        string | null
      >`coalesce(${projects.archivedAt}, ${goals.archivedAt}, ${areas.archivedAt})`,
    })
    .from(tasks)
    .leftJoin(projects, ofType("project", projects.id))
    .leftJoin(goals, ofType("goal", goals.id))
    .leftJoin(areas, ofType("area", areas.id))
    .where(likeAny([tasks.title], patterns))
    .orderBy(desc(tasks.updatedAt))
    .limit(CANDIDATES_PER_SOURCE);

  const hits: RankedHit[] = [];
  for (const r of rows) {
    const score = titleScore(r.title, query);
    if (!score) continue;
    const parent = r.parentType && r.parentId ? { type: r.parentType, id: r.parentId } : null;
    hits.push({
      type: "task",
      id: r.id,
      title: r.title,
      snippet: null,
      field: "title",
      href: parent ? itemHref(parent.type, parent.id, r.parentTitle) : "/tasks?tab=by-parent",
      ...(parent && r.parentTitle !== null ? { parentTitle: r.parentTitle } : {}),
      score,
      archived: r.parentArchived != null,
      updatedAt: r.updatedAt,
    });
  }
  return hits;
}

/** Substring search with LIKE: works on any libSQL/Turso database without schema changes. */
export const likeEngine: SearchEngine = {
  async search(query, limit) {
    if (!query) return [];
    const patterns = likePatterns(query);
    const groups = await Promise.all([
      ...SOURCES.map((s) => searchItems(s, query, patterns)),
      searchHighlights(query, patterns),
      searchTasks(query, patterns),
    ]);
    return groups
      .flat()
      .sort(compareHits)
      .slice(0, limit)
      .map((hit) => {
        const { updatedAt, ...rest } = hit;
        void updatedAt;
        return rest;
      });
  },
};
