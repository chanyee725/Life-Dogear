/** Title and body of a thought made from a highlight ("생각 만들기"). */

export const THOUGHT_TITLE_MAX = 80;

/** Collapses whitespace (PDF text often carries hard line breaks). */
export const normalizeHighlightText = (text: string): string => text.replace(/\s+/g, " ").trim();

/** First `THOUGHT_TITLE_MAX` characters of the highlight, with `…` when cut. */
export function thoughtTitleFrom(text: string): string {
  const clean = normalizeHighlightText(text);
  const chars = Array.from(clean); // don't split surrogate pairs
  if (chars.length <= THOUGHT_TITLE_MAX) return clean || "하이라이트에서 만든 생각";
  return `${chars.slice(0, THOUGHT_TITLE_MAX).join("").trimEnd()}…`;
}

/**
 * Markdown body:
 *
 * ```
 * > highlighted text
 *
 * — 논문 제목, p. 12
 *
 * my note
 * ```
 */
export function thoughtBodyFrom(input: {
  text: string;
  page: number;
  note?: string;
  paperTitle: string;
}): string {
  const quote = normalizeHighlightText(input.text);
  const parts = [`> ${quote}`, `— ${input.paperTitle.trim()}, p. ${input.page}`];
  const note = input.note?.trim();
  if (note) parts.push(note);
  return `${parts.join("\n\n")}\n`;
}
