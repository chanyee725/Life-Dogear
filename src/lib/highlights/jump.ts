/** `?page=12&scroll=0.25` links into the reader (from the highlight list). */

export function readerHref(paperId: string, page: number, scroll = 0): string {
  const params = new URLSearchParams({ page: String(page) });
  if (scroll > 0) params.set("scroll", String(scroll));
  return `/papers/${paperId}/read?${params}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Reads `page` (positive integer) and `scroll` (0–1) from the reader's search
 * params. Returns null when no valid page is given, so the saved position is used.
 */
export function parseJumpParams(params: SearchParams): { page: number; scroll: number } | null {
  const pageText = first(params.page);
  if (!pageText || !/^\d{1,6}$/.test(pageText)) return null;
  const page = Number(pageText);
  if (page < 1) return null;
  const scrollText = first(params.scroll);
  const scroll = scrollText && /^(0(\.\d+)?|1(\.0+)?)$/.test(scrollText) ? Number(scrollText) : 0;
  return { page, scroll };
}
