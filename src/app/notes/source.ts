/** Pure helpers for note sources (출처) on the notes screens. */

import { stripColumnMarkers } from "@/lib/column-markers";

/** `http(s)://…` only; other schemes never become a link. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * First non-heading text line of a Markdown body, for card previews (photos and
 * checkbox markers dropped).
 */
export function bodyPreview(body: string): string {
  const line = stripColumnMarkers(body)
    .split("\n")
    .map((l) =>
      l
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/^[#>\-*\s]+|\[[ x]\]\s*/g, "")
        .trim(),
    )
    .find(Boolean);
  return line ?? "";
}
