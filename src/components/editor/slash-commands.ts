import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { insertColumns } from "./columns-edit";
import { findWikiTrigger } from "./WikiSuggest";

export type SlashCommandId =
  | "page"
  | "h2"
  | "h3"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "code"
  | "table"
  | "image"
  | "columns2"
  | "columns3";

export type SlashCommand = {
  id: SlashCommandId;
  label: string;
  /** Short mark shown before the label. */
  icon: string;
  /** Extra words that find it (lower case). */
  aliases: readonly string[];
  /** Applies the command (the `/query` is already removed); else the menu's own switch does. */
  run?: (editor: Editor) => boolean;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { id: "page", label: "페이지", icon: "📄", aliases: ["page", "노트", "note"] },
  { id: "h2", label: "제목 2", icon: "H2", aliases: ["h2", "heading", "머리글"] },
  { id: "h3", label: "제목 3", icon: "H3", aliases: ["h3", "heading", "머리글"] },
  { id: "bullet", label: "목록", icon: "•", aliases: ["list", "bullet", "ul"] },
  { id: "ordered", label: "번호 목록", icon: "1.", aliases: ["number", "ol", "번호"] },
  { id: "task", label: "할 일", icon: "☐", aliases: ["todo", "task", "체크"] },
  { id: "quote", label: "인용", icon: "❝", aliases: ["quote"] },
  { id: "code", label: "코드", icon: "</>", aliases: ["code"] },
  { id: "table", label: "표", icon: "▦", aliases: ["table"] },
  { id: "image", label: "사진", icon: "🖼", aliases: ["image", "photo", "img", "이미지"] },
  {
    id: "columns2",
    label: "2열",
    icon: "▥",
    aliases: ["/2", "2", "columns", "열", "단"],
    run: (editor) => insertColumns(editor, 2),
  },
  {
    id: "columns3",
    label: "3열",
    icon: "▥",
    aliases: ["/3", "3", "columns", "열", "단"],
    run: (editor) => insertColumns(editor, 3),
  },
];

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * Commands matching the typed query: label or alias starting with it (spaces ignored,
 * so "할일" finds 할 일), then any containing it — except digit-only queries, which
 * match by prefix only so /2 opens 2열 and not 제목 2. Without `page`, 페이지 is left out.
 */
export function filterSlashCommands(query: string, { page }: { page: boolean }): SlashCommand[] {
  const q = squash(query);
  const pool = SLASH_COMMANDS.filter((c) => page || c.id !== "page");
  if (!q) return pool;
  const words = (c: SlashCommand) => [c.label, ...c.aliases].map(squash);
  const starts = pool.filter((c) => words(c).some((w) => w.startsWith(q)));
  if (/^\d+$/.test(q)) return starts;
  const contains = pool.filter((c) => !starts.includes(c) && words(c).some((w) => w.includes(q)));
  return [...starts, ...contains];
}

/** Typed `/query` before the cursor: `from` is the `/`. */
export type SlashTrigger = { from: number; to: number; query: string };

const ATOM = "￼";
// `/` at the line start, after a space or after a line break; the query may hold inner
// spaces (할 일) but cannot start with one or cross a line break.
const SLASH_RE = /(?:^|\s)\/((?:[^\s/][^/\n]{0,19})?)$/;

/** A line break reads as a newline (so `/` right after one opens); other atoms block. */
const leafText = (node: { type: { name: string } }) =>
  node.type.name === "hardBreak" ? "\n" : ATOM;

/** The open `/…` before the cursor, if any (pure; exported for tests). */
export function findSlashTrigger(state: EditorState): SlashTrigger | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  if ($from.marks().some((m) => m.type.name === "code")) return null;
  if (findWikiTrigger(state)) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, leafText);
  const m = SLASH_RE.exec(before);
  if (!m || m[1].includes(ATOM)) return null;
  const query = m[1];
  return { from: $from.pos - query.length - 1, to: $from.pos, query };
}

/**
 * Next trigger while an IME may be composing. During Korean composition the document
 * holds half-built syllables (`/ㅍ`, `/페ㅇ`); filtering on those would close and reopen
 * the menu on every keystroke. So while composing, the same `/` keeps its last settled
 * query (positions still follow the document); the new query applies once composition ends.
 */
export function settleSlashTrigger(
  prev: SlashTrigger | null,
  next: SlashTrigger | null,
  composing: boolean,
): SlashTrigger | null {
  if (!composing || !prev || !next || prev.from !== next.from) return next;
  return { ...next, query: prev.query };
}

/** A key event that belongs to an IME (Enter/arrows confirming a Korean syllable). */
export function isImeKey(event: Pick<KeyboardEvent, "isComposing" | "keyCode">): boolean {
  // Safari reports the confirming keydown after compositionend, with keyCode 229.
  return event.isComposing || event.keyCode === 229;
}
