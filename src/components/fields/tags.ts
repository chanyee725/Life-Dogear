/** Normalizes a raw tag: trims, drops a leading `#`, collapses inner whitespace. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();
}

/** Adds one or more comma-separated tags, skipping empties and case-insensitive duplicates. */
export function addTags(current: readonly string[], raw: string): string[] {
  const next = [...current];
  const seen = new Set(current.map((t) => t.toLowerCase()));
  for (const part of raw.split(",")) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    next.push(tag);
  }
  return next;
}
