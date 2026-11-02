export type QueryParams = Record<string, string | string[] | undefined>;

/**
 * Builds `basePath?query` from current params with some keys replaced.
 * `undefined`/"" in `patch` removes the key. Array values keep only the first entry.
 */
export function buildHref(
  basePath: string,
  params: QueryParams,
  patch: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) search.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value) search.set(key, value);
    else search.delete(key);
  }
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** First value of a search param, or undefined. */
export function firstParam(params: QueryParams, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value || undefined;
}

/** Tag counts over a set of items (for the tag filter of one list). */
export function countTags(
  items: readonly { tags: readonly string[] }[],
): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    for (const name of item.tags) {
      const key = name.toLowerCase();
      const entry = counts.get(key) ?? { name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** Keeps items carrying `tag` (case-insensitive); no tag keeps all. */
export function filterByTag<T extends { tags: readonly string[] }>(
  items: readonly T[],
  tag: string | undefined,
): T[] {
  if (!tag) return [...items];
  const key = tag.toLowerCase();
  return items.filter((item) => item.tags.some((t) => t.toLowerCase() === key));
}
