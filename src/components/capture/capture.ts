/**
 * Quick capture (docs/design/today.md 6절). Pure helpers: no DOM, no network — a link is
 * saved as a thought with the URL in its body; nothing is fetched.
 */

/** Window event that opens the capture dialog (shortcut `C`, the Cmd+K command). */
export const OPEN_CAPTURE_EVENT = "rb:open-capture";

/** Toast lifetime (ms); paused while hovered or focused. */
export const TOAST_MS = 3000;
/** Second Esc within this window closes a capture that has text. */
export const ESC_CONFIRM_MS = 2000;

export type CaptureKind = "thought" | "link";

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

export type CaptureDraft = { kind: CaptureKind; text: string; url: string; note: string };

export const EMPTY_DRAFT: CaptureDraft = { kind: "thought", text: "", url: "", note: "" };

/** Something typed that closing would lose. */
export const hasContent = (d: CaptureDraft): boolean =>
  d.kind === "thought" ? d.text.trim() !== "" : d.url.trim() !== "" || d.note.trim() !== "";

/** Text to save, or an error message. */
export function draftToText(d: CaptureDraft): { text: string } | { error: string } {
  if (d.kind === "thought") {
    return d.text.trim() ? { text: d.text } : { error: "내용을 입력하세요." };
  }
  if (!d.url.trim()) return { error: "링크를 입력하세요." };
  const text = linkThoughtText(d.url, d.note);
  return text ? { text } : { error: "http:// 또는 https:// 링크를 입력하세요." };
}

export type SaveKey = "close" | "continue" | null;

/**
 * ⌘/Ctrl+Enter saves and closes, ⇧⌘/Ctrl+Enter saves and keeps the dialog. In the link
 * field a plain Enter saves too. Never while the IME is composing.
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
  field: "text" | "url" | "note",
): SaveKey {
  if (e.key !== "Enter" || e.altKey || e.isComposing || e.keyCode === 229) return null;
  if (e.metaKey || e.ctrlKey) return e.shiftKey ? "continue" : "close";
  if (field !== "text" && !e.shiftKey) return "close";
  return null;
}
