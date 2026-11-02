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
