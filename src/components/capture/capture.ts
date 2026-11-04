/**
 * Quick capture (docs/design/today.md 6절). Pure helpers: no DOM, no network — a link is
 * saved as a thought with the URL in its body; nothing is fetched. 노트 (단계 N) saves a
 * title and a body as a new note.
 */

/** Window event that opens the capture dialog (shortcut `C`, the Cmd+K command). */
export const OPEN_CAPTURE_EVENT = "rb:open-capture";

/** Toast lifetime (ms); paused while hovered or focused. */
export const TOAST_MS = 3000;
/** Second Esc within this window closes a capture that has text. */
export const ESC_CONFIRM_MS = 2000;

export type CaptureKind = "thought" | "link" | "note";

/** Order of the kind switch (← → move through it, wrapping). */
export const CAPTURE_KINDS: readonly CaptureKind[] = ["thought", "link", "note"];

/** The kind left (-1) or right (+1) of `kind`, wrapping around. */
export function nextKind(kind: CaptureKind, step: 1 | -1): CaptureKind {
  const i = CAPTURE_KINDS.indexOf(kind);
  const n = CAPTURE_KINDS.length;
  return CAPTURE_KINDS[(i + step + n) % n];
}

const MAX_URL = 2048;
const LINK_TITLE_MAX = 60;

/** `http(s)://…` parsed, or null. */
export function parseHttpUrl(text: string): URL | null {
  const value = text.trim();
  if (!value || value.length > MAX_URL || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Pasted text that is a single http(s) URL and nothing else switches to 링크. */
export const isBareUrl = (text: string): boolean => parseHttpUrl(text) !== null;

/** Host (no `www.`) + path, without a trailing `/`, at most 60 characters. */
export function linkTitle(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  let text = `${host}${path}`;
  try {
    text = decodeURI(text);
  } catch {
    // keep the encoded form
  }
  return text.length > LINK_TITLE_MAX ? `${text.slice(0, LINK_TITLE_MAX - 1)}…` : text;
}

/**
 * Text for `createQuickThought` (first line = title, the rest = body): the note's first
 * line, or `linkTitle(url)`, then the URL. Null when the URL is not http(s).
 */
export function linkThoughtText(urlText: string, note: string): string | null {
  const url = parseHttpUrl(urlText);
  if (!url) return null;
  const first = note.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const restOfNote = note.trim().split(/\r?\n/).slice(1).join("\n").trim();
  const title = first || linkTitle(url);
  return [title, "", url.href, ...(restOfNote ? ["", restOfNote] : [])].join("\n");
}

export type CaptureDraft = {
  kind: CaptureKind;
  text: string;
  url: string;
  note: string;
  /** 노트 title and body. */
  title: string;
  body: string;
};

export const EMPTY_DRAFT: CaptureDraft = {
  kind: "thought",
  text: "",
  url: "",
  note: "",
  title: "",
  body: "",
};

/** Something typed that closing would lose. */
export function hasContent(d: CaptureDraft): boolean {
  if (d.kind === "thought") return d.text.trim() !== "";
  if (d.kind === "link") return d.url.trim() !== "" || d.note.trim() !== "";
  return d.title.trim() !== "" || d.body.trim() !== "";
}

/** Thought text to save (생각, 링크), or an error message. */
export function draftToText(d: CaptureDraft): { text: string } | { error: string } {
  if (d.kind === "thought") {
    return d.text.trim() ? { text: d.text } : { error: "내용을 입력하세요." };
  }
  if (d.kind === "note") return { error: "노트는 제목과 본문으로 저장합니다." };
  if (!d.url.trim()) return { error: "링크를 입력하세요." };
  const text = linkThoughtText(d.url, d.note);
  return text ? { text } : { error: "http:// 또는 https:// 링크를 입력하세요." };
}

export type CaptureSave =
  { kind: "thought"; text: string } | { kind: "note"; title: string; body: string };

/** What to save for the draft: a thought (생각, 링크) or a note, or an error message. */
export function draftToSave(d: CaptureDraft): CaptureSave | { error: string } {
  if (d.kind === "note") {
    const title = d.title.trim();
    if (!title) return { error: "제목을 입력하세요." };
    // Keep leading indentation (an indented code block is Markdown); drop trailing blanks.
    return { kind: "note", title, body: d.body.trim() ? d.body.trimEnd() : "" };
  }
  const result = draftToText(d);
  return "error" in result ? result : { kind: "thought", text: result.text };
}

export type SaveKey = "close" | "continue" | null;

/** Capture inputs: 생각 text, 링크 url + note, 노트 title + body. */
export type CaptureField = "text" | "url" | "note" | "title" | "body";

/**
 * ⌘/Ctrl+Enter saves and closes, ⇧⌘/Ctrl+Enter saves and keeps the dialog. In the link
 * fields a plain Enter saves too; in the note title it moves to the body (the dialog
 * handles that, not here). Never while the IME is composing.
 */
export function saveKey(
  e: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    isComposing?: boolean;
    keyCode?: number;
  },
  field: CaptureField,
): SaveKey {
  if (e.key !== "Enter" || e.altKey || e.isComposing || e.keyCode === 229) return null;
  if (e.metaKey || e.ctrlKey) return e.shiftKey ? "continue" : "close";
  if ((field === "url" || field === "note") && !e.shiftKey) return "close";
  return null;
}

/** The 생각 box grows with its text from 3 lines up to 12, then scrolls (today.md 6절). */
export const THOUGHT_MIN_ROWS = 3;
export const THOUGHT_MAX_ROWS = 12;

/**
 * Height (px, border-box) for an auto-growing textarea: the content height clamped to
 * `minRows`..`maxRows` lines, and whether it has to scroll. `chrome` = vertical padding + border.
 */
export function autosizeHeight(
  contentHeight: number,
  lineHeight: number,
  chrome: number,
  minRows = THOUGHT_MIN_ROWS,
  maxRows = THOUGHT_MAX_ROWS,
): { height: number; scroll: boolean } {
  const min = minRows * lineHeight + chrome;
  const max = maxRows * lineHeight + chrome;
  const wanted = contentHeight + chrome;
  return { height: Math.min(Math.max(wanted, min), max), scroll: wanted > max };
}
