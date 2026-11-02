export type ProgressInput = { page: number; scroll: number; totalPages?: number };

/** Bodies larger than this are rejected before parsing. */
export const MAX_PROGRESS_BODY = 1024;

const MAX_PAGES = 100_000;

/**
 * Validates a reading-position body. Accepts JSON sent as `application/json`
 * (fetch) or `text/plain` (navigator.sendBeacon). Returns null when invalid.
 */
export function parseProgressInput(raw: string): ProgressInput | null {
  if (raw.length > MAX_PROGRESS_BODY) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { page, scroll, totalPages } = value as Record<string, unknown>;

  if (!isPageNumber(page)) return null;
  if (typeof scroll !== "number" || !Number.isFinite(scroll) || scroll < 0 || scroll > 1) {
    return null;
  }
  if (totalPages === undefined || totalPages === null) return { page, scroll };
  if (!isPageNumber(totalPages) || page > totalPages) return null;
  return { page, scroll, totalPages };
}

function isPageNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_PAGES;
}
