/**
 * Column blocks are stored in Markdown as `::: columns` / `::: column` / `:::` lines
 * (see `@/components/editor/columns-markdown`). Search snippets and previews drop them.
 */
const MARKER_LINE = /^[ \t]{0,3}:::(?:[ \t]*columns?)?[ \t]*$/;

/** Markdown `text` without column marker lines. */
export function stripColumnMarkers(text: string): string {
  if (!text.includes(":::")) return text;
  return text
    .split("\n")
    .filter((line) => !MARKER_LINE.test(line.replace(/\r$/, "")))
    .join("\n");
}
