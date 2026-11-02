/**
 * "라이너 스콜라 메모": text the user copied from Liner (answer, summary or
 * highlight) is stored inside the paper body under one markdown section, with its
 * kind, save date and optional source link. Pure functions; no schema change.
 */

export const LINER_SECTION_TITLE = "라이너 스콜라 메모";
export const LINER_SECTION_HEADING = `## ${LINER_SECTION_TITLE}`;

export const LINER_MEMO_KINDS = ["answer", "summary", "highlight"] as const;
export type LinerMemoKind = (typeof LINER_MEMO_KINDS)[number];

export const LINER_MEMO_KIND_LABEL: Record<LinerMemoKind, string> = {
  answer: "답변",
  summary: "요약",
  highlight: "하이라이트",
};

export const MAX_LINER_MEMO_TEXT = 20_000;
export const MAX_LINER_SOURCE_URL = 2_000;

export type LinerMemoEntry = {
  kind: LinerMemoKind;
  text: string;
  /** http(s) link to the Liner page the text came from. */
  sourceUrl?: string;
  /** Save date, `YYYY-MM-DD`. */
  date: string;
};

export const isLinerMemoKind = (v: unknown): v is LinerMemoKind =>
  typeof v === "string" && (LINER_MEMO_KINDS as readonly string[]).includes(v);

/** Local calendar date as `YYYY-MM-DD` (the app runs on the user's machine). */
export function formatLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Normalised http(s) URL safe to place in a markdown link, or null.
 * Parentheses and spaces are percent-encoded so they cannot end the link early.
 */
export function safeSourceUrl(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text || text.length > MAX_LINER_SOURCE_URL) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.href.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/ /g, "%20");
}

/**
 * Markdown block for one memo:
 *
 * ```
 * ### 하이라이트 · 2026-11-02
 *
 * > pasted line 1
 * > pasted line 2
 *
 * 출처: [라이너](https://…)
 * ```
 *
 * The pasted text is quoted line by line, so headings inside it (`## …`) cannot
 * start a new section and break the memo section's boundaries.
 */
export function formatLinerMemo(entry: LinerMemoEntry): string {
  const lines = entry.text
    .replace(/\r\n?/g, "\n")
    .replace(/^\n+|\s+$/g, "")
    .split("\n")
    .map((line) => (line.trim() ? `> ${line}` : ">"));
  const url = safeSourceUrl(entry.sourceUrl);
  const source = url ? `출처: [라이너](${url})` : "출처: 라이너 스콜라";
  return [
    `### ${LINER_MEMO_KIND_LABEL[entry.kind]} · ${entry.date}`,
    "",
    ...lines,
    "",
    source,
  ].join("\n");
}

const SECTION_RE = /^##\s+라이너 스콜라 메모\s*#*\s*$/;
/** Headings that close a level-2 section (`#` or `##`). */
const SECTION_END_RE = /^#{1,2}\s/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;

/** Index of the memo heading line and the line where its section ends (exclusive). */
function findSection(lines: string[]): { start: number; end: number } | null {
  let inFence = false;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (start === -1) {
      if (SECTION_RE.test(lines[i])) start = i;
    } else if (SECTION_END_RE.test(lines[i])) {
      return { start, end: i };
    }
  }
  return start === -1 ? null : { start, end: lines.length };
}

/**
 * Appends a memo block at the end of the `## 라이너 스콜라 메모` section (after
 * earlier memos, before the next `#`/`##` heading). Creates the section at the end
 * of the body when it is missing. Everything outside the section is unchanged.
 */
export function appendLinerMemo(body: string, block: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const section = findSection(lines);

  if (!section) {
    const head = body.replace(/\s+$/, "");
    return `${head ? `${head}\n\n` : ""}${LINER_SECTION_HEADING}\n\n${block}\n`;
  }

  // Section content without trailing blank lines, then the new block.
  let contentEnd = section.end;
  while (contentEnd > section.start + 1 && !lines[contentEnd - 1].trim()) contentEnd--;
  const before = lines.slice(0, contentEnd);
  const after = lines.slice(section.end);

  const merged = [...before, "", block];
  if (after.length) merged.push("", ...after);
  else merged.push("");
  return merged.join("\n");
}

export type LinerMemoInputError = "kind" | "empty" | "too_long" | "source_url";

export const LINER_MEMO_INPUT_MESSAGES: Record<LinerMemoInputError, string> = {
  kind: "종류를 골라 주세요.",
  empty: "붙여넣을 내용을 입력해 주세요.",
  too_long: `내용이 너무 깁니다. ${MAX_LINER_MEMO_TEXT.toLocaleString("ko-KR")}자 이하로 줄여 주세요.`,
  source_url: "출처 링크는 http:// 또는 https://로 시작하는 주소여야 합니다.",
};

/** Checks user input for a memo; returns the first problem or null. */
export function validateLinerMemoInput(input: {
  kind: unknown;
  text: unknown;
  sourceUrl?: unknown;
}): LinerMemoInputError | null {
  if (!isLinerMemoKind(input.kind)) return "kind";
  if (typeof input.text !== "string" || !input.text.trim()) return "empty";
  if (input.text.length > MAX_LINER_MEMO_TEXT) return "too_long";
  const src = input.sourceUrl;
  if (src !== undefined && src !== null && src !== "") {
    if (typeof src !== "string" || !safeSourceUrl(src)) return "source_url";
  }
  return null;
}

/** Formats `input` with today's local date and appends it to `body`. Input must be valid. */
export function appendLinerMemoEntry(
  body: string,
  input: { kind: LinerMemoKind; text: string; sourceUrl?: string },
  now: Date = new Date(),
): string {
  return appendLinerMemo(body, formatLinerMemo({ ...input, date: formatLocalDate(now) }));
}
