import type { ItemType } from "@/lib/enums";

/** What a hit points at: an item (project, area, paper, seminar, thought), or a PDF highlight. */
export type SearchHitType = ItemType | "highlight";

/** Which text matched; drives ranking and the hint shown next to the snippet. */
export type SearchField = "title" | "meta" | "body" | "highlight" | "note";

/** Text around the first match, split so the UI can wrap `match` in <mark> without HTML. */
export type Snippet = { before: string; match: string; after: string };

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  /** Null when only the title matched (the title already shows the match). */
  snippet: Snippet | null;
  field: SearchField;
  /** Detail page, or the PDF reader at the highlight's page. */
  href: string;
  /** Highlights only. */
  paperId?: string;
  page?: number;
  /** Higher ranks first. */
  score: number;
  /**
   * The item is archived (for a highlight: its paper is). Archived items stay
   * searchable and keep their rank; the palette marks them "보관됨".
   */
  archived: boolean;
};

/** `limit` may be a raw query-string value; it is clamped to 1..50 (default 20). */
export type SearchOptions = { limit?: number | string };

/** Swappable backend (LIKE scan today, FTS5 later — see docs/p2/search-design.md). */
export interface SearchEngine {
  search(query: string, limit: number): Promise<SearchHit[]>;
}
