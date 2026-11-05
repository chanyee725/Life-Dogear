import { type ItemType } from "@/lib/enums";
import type { SearchField, SearchHit, Snippet } from "./types";
import { itemHref as detailHref } from "@/lib/item-href";

export const MAX_QUERY_LENGTH = 200;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Grapheme clusters never exceed this many UTF-16 units in practice (ZWJ families: 11). */
const GRAPHEME_LOOKAROUND = 64;

/**
 * Nearest user-perceived character boundary at or before (`dir` -1) / after (`dir` 1)
 * the UTF-16 index `i`, so cuts never split an emoji, ZWJ sequence or combining mark.
 * Falls back to surrogate-pair boundaries without `Intl.Segmenter`.
 */
export function graphemeBoundary(text: string, i: number, dir: -1 | 1): number {
  if (i <= 0) return 0;
  if (i >= text.length) return text.length;
  if (!segmenter) {
    const low = text.charCodeAt(i);
    const high = text.charCodeAt(i - 1);
    const splitsPair = low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff;
    return splitsPair ? i + dir : i;
  }
  let from = Math.max(0, i - GRAPHEME_LOOKAROUND);
  const first = text.charCodeAt(from);
  if (from > 0 && first >= 0xdc00 && first <= 0xdfff) from--; // start on a whole code point
  const piece = text.slice(from, Math.min(text.length, i + GRAPHEME_LOOKAROUND));
  const rel = i - from;
  for (const { index, segment } of segmenter.segment(piece)) {
    if (rel === index) return i;
    if (rel < index + segment.length) return from + (dir < 0 ? index : index + segment.length);
  }
  return i;
}

/** NFC, trimmed, inner whitespace collapsed, capped at MAX_QUERY_LENGTH whole characters. */
export function normalizeQuery(query: unknown): string {
  if (typeof query !== "string") return "";
  const text = query.normalize("NFC").replace(/\s+/g, " ").trim();
  if (text.length <= MAX_QUERY_LENGTH) return text;
  return text.slice(0, graphemeBoundary(text, MAX_QUERY_LENGTH, -1)).trimEnd();
}

export function clampLimit(limit: unknown): number {
  const n = typeof limit === "number" ? limit : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(n)));
}

/** Escapes LIKE wildcards; use with `escape '\'`. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Lower-cases A–Z only, matching SQLite's `lower()` (which leaves non-ASCII alone). */
export const lowerAscii = (s: string): string => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

/**
 * Query forms to compare against `lower(column)` in SQL. Text pasted from macOS can be
 * stored decomposed (NFD), which SQL cannot normalize, so the NFD form is searched too
 * when it differs. SQL `lower()` only lower-cases ASCII, so two casings are sent:
 * - ASCII-only lower-cased: `Österreich` finds itself (stored `Ö` stays `Ö` in SQL);
 * - fully lower-cased: `ÖSTERREICH` also finds a stored `österreich`.
 * A lower-case non-ASCII query still misses a capitalised original (`österreich` vs
 * `Österreich`); the final match check in JS uses the full `fold`.
 */
export function sqlQueryForms(query: string): string[] {
  const forms = [query.normalize("NFC"), query.normalize("NFD")].flatMap((f) => [
    lowerAscii(f),
    f.toLowerCase(),
  ]);
  return [...new Set(forms)];
}

/** LIKE patterns (`%…%`, wildcards escaped) for `sqlQueryForms`. */
export function likePatterns(query: string): string[] {
  return sqlQueryForms(query).map((f) => `%${escapeLike(f)}%`);
}

/** Case- and normalization-insensitive form used for matching in JS. */
export const fold = (s: string): string => s.normalize("NFC").toLowerCase();

/** Index of `query` in `text` after folding both, or -1. Offsets refer to the folded text. */
export function findMatch(text: string, query: string): number {
  return query ? fold(text).indexOf(fold(query)) : -1;
}

/** Markdown body → plain prose for snippets (syntax marks and link targets removed). */
export function plainText(markdown: string): string {
  return markdown
    .normalize("NFC")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links/images → label
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list marks
    .replace(/\[[ xX]\]\s+/g, "") // task boxes
    .replace(/[*_`~|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 60;

/**
 * Text around the first match of `query`. Returns null when `text` does not contain it
 * (e.g. the match spans markdown syntax that `plainText` removed).
 */
export function makeSnippet(text: string, query: string): Snippet | null {
  const folded = fold(text);
  const source = text.normalize("NFC");
  // Lower-casing can change length for a few scripts; fall back to no snippet then.
  if (folded.length !== source.length) return null;
  const at = findMatch(source, query);
  if (at < 0) return null;
  const end = at + fold(query).length;
  // Window edges snap outwards-safe to character boundaries (never half an emoji).
  // Clamped so a query that starts or ends inside a cluster still keeps its match.
  const start = Math.min(at, graphemeBoundary(source, at - SNIPPET_BEFORE, 1));
  const stop = Math.max(end, graphemeBoundary(source, end + SNIPPET_AFTER, -1));
  return {
    before: (start > 0 ? "…" : "") + source.slice(start, at),
    match: source.slice(at, end),
    after: source.slice(end, stop) + (stop < source.length ? "…" : ""),
  };
}

/** Base score per matched field; title matches always outrank everything else. */
export const FIELD_SCORE: Record<SearchField, number> = {
  title: 60,
  meta: 40,
  highlight: 35,
  note: 30,
  body: 20,
};

/** Title score: exact > prefix > contains (0 when the title does not match). */
export function titleScore(title: string, query: string): number {
  const t = fold(title).trim();
  const q = fold(query);
  if (!q || !t.includes(q)) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  return FIELD_SCORE.title;
}

/** A hit plus the timestamp used to break ties (updated, or created for highlights). */
export type RankedHit = SearchHit & { updatedAt: string };

/**
 * Result order shared by search engines. Score first; archiving never hides or
 * demotes a better match. Among equal scores the active item comes before the
 * archived one, then the most recently updated.
 */
export function compareHits(a: RankedHit, b: RankedHit): number {
  return (
    b.score - a.score ||
    Number(a.archived) - Number(b.archived) ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/** Detail page of an item; routes come from the shared `ITEM_ROUTE` map (incl. `/areas`). */
export const itemHref = (type: ItemType, id: string, title?: string | null): string =>
  detailHref(type, id, title);
