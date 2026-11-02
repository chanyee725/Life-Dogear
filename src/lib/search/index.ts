import { likeEngine } from "./like-engine";
import { clampLimit, normalizeQuery } from "./text";
import type { SearchEngine, SearchHit, SearchOptions } from "./types";

export type { SearchEngine, SearchField, SearchHit, SearchHitType, Snippet } from "./types";
export { MAX_QUERY_LENGTH } from "./text";

let engine: SearchEngine = likeEngine;

/** Replaces the backend (e.g. an FTS5 engine once its migration lands). */
export function setSearchEngine(next: SearchEngine): void {
  engine = next;
}

/**
 * Searches titles, bodies and key fields of every item type (projects, areas, papers,
 * seminars, thoughts) plus highlight text/notes. Archived items are included, flagged.
 * Title matches rank first (exact > prefix > contains), then key fields, highlights, bodies;
 * ties go to the non-archived item, then the most recently updated. Blank queries return nothing.
 */
export async function searchAll(query: unknown, options: SearchOptions = {}): Promise<SearchHit[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  return engine.search(q, clampLimit(options.limit));
}
