/**
 * `[[제목]]` wiki links in Markdown bodies (Obsidian style). Pure helpers shared by the
 * editor (rendering) and the repo (link sync, rename).
 *
 * Rules:
 * - A link is `[[title]]`; the title has no brackets or line breaks and is trimmed.
 * - Fenced code blocks, inline code and quotes (`>` lines, e.g. liner-note quotes) never
 *   count as links.
 * - The editor's Markdown escapes typed brackets (`\[\[x\]\]`); those count too.
 */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const QUOTE_RE = /^ {0,3}>/;
const LINK_RE = /\[\[([^[\]\n]+)\]\]/g;
const MAX_TITLE = 300;

/** Comparison key for titles: NFC, runs of whitespace as one space, trimmed, case-insensitive (Unicode). */
export const titleKey = (title: string): string =>
  title.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Clean display form of a title written inside `[[…]]`; null when unusable. */
export function cleanTitle(raw: string): string | null {
  const title = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return title && title.length <= MAX_TITLE ? title : null;
}

type Segment = { text: string; live: boolean };

/** Splits one line into inline-code (dead) and other (live) parts. */
function splitInlineCode(line: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let start = 0;
  while (i < line.length) {
    if (line[i] === "\\") {
      i += 2;
      continue;
    }
    if (line[i] !== "`") {
      i++;
      continue;
    }
    let run = 1;
    while (line[i + run] === "`") run++;
    const fence = "`".repeat(run);
    let close = line.indexOf(fence, i + run);
    // A longer run is not a match for this opener.
    while (close !== -1 && line[close + run] === "`") {
      let skip = close;
      while (line[skip] === "`") skip++;
      close = line.indexOf(fence, skip);
    }
    if (close === -1) {
      i += run;
      continue;
    }
    if (i > start) out.push({ text: line.slice(start, i), live: true });
    out.push({ text: line.slice(i, close + run), live: false });
    i = close + run;
    start = i;
  }
  if (start < line.length) out.push({ text: line.slice(start), live: true });
  return out;
}

type Line = { segments: Segment[] };

/** Lines of the body, each split into live and dead (code/quote) segments. */
function scan(markdown: string): Line[] {
  const lines = markdown.split("\n");
  const out: Line[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const m = FENCE_RE.exec(line);
    if (fence !== null) {
      if (
        m &&
        m[1][0] === fence[0] &&
        m[1].length >= fence.length &&
        !line.slice(m[0].length).trim()
      ) {
        fence = null;
      }
      out.push({ segments: [{ text: line, live: false }] });
      continue;
    }
    if (m) {
      fence = m[1];
      out.push({ segments: [{ text: line, live: false }] });
      continue;
    }
    if (QUOTE_RE.test(line)) {
      out.push({ segments: [{ text: line, live: false }] });
      continue;
    }
    out.push({ segments: splitInlineCode(line) });
  }
  return out;
}

/** `\[` → `[`, `\]` → `]` so escaped links are found. */
const unescapeBrackets = (s: string) => s.replace(/\\([[\]])/g, "$1");

/** Distinct link titles in the body, in first-seen order (case-insensitive dedupe). */
export function extractWikiTitles(markdown: string): string[] {
  const seen = new Map<string, string>();
  for (const line of scan(markdown)) {
    for (const seg of line.segments) {
      if (!seg.live) continue;
      for (const m of unescapeBrackets(seg.text).matchAll(LINK_RE)) {
        const title = cleanTitle(m[1]);
        if (title && !seen.has(titleKey(title))) seen.set(titleKey(title), title);
      }
    }
  }
  return [...seen.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces `[[from]]` (case-insensitive, escaped forms included) with `[[to]]` outside
 * code and quotes. Returns the new body and how many links changed.
 */
export function renameWikiTitle(
  markdown: string,
  from: string,
  to: string,
): { body: string; count: number } {
  const source = cleanTitle(from);
  const target = cleanTitle(to);
  if (!source || !target) return { body: markdown, count: 0 };
  const word = source
    .split("")
    .map((c) => (c === " " ? "\\s+" : escapeRe(c)))
    .join("");
  const re = new RegExp(`\\\\?\\[\\\\?\\[\\s*${word}\\s*\\\\?\\]\\\\?\\]`, "giu");
  let count = 0;
  const lines = scan(markdown).map((line) =>
    line.segments
      .map((seg) =>
        seg.live
          ? seg.text.replace(re, () => {
              count++;
              return `[[${target}]]`;
            })
          : seg.text,
      )
      .join(""),
  );
  return { body: lines.join("\n"), count };
}
