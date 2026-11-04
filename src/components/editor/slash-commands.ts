import type { EditorState } from "@tiptap/pm/state";
import { findWikiTrigger } from "./WikiSuggest";

export type SlashCommandId =
  "page" | "h2" | "h3" | "bullet" | "ordered" | "task" | "quote" | "code" | "table" | "image";

export type SlashCommand = {
  id: SlashCommandId;
  label: string;
  /** Short mark shown before the label. */
  icon: string;
  /** Extra words that find it (lower case). */
  aliases: readonly string[];
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
];

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * Commands matching the typed query: label or alias starting with it (spaces ignored,
 * so "할일" finds 할 일), then any containing it. Without `page`, 페이지 is left out.
 */
export function filterSlashCommands(query: string, { page }: { page: boolean }): SlashCommand[] {
  const q = squash(query);
  const pool = SLASH_COMMANDS.filter((c) => page || c.id !== "page");
  if (!q) return pool;
  const words = (c: SlashCommand) => [c.label, ...c.aliases].map(squash);
  const starts = pool.filter((c) => words(c).some((w) => w.startsWith(q)));
  const contains = pool.filter((c) => !starts.includes(c) && words(c).some((w) => w.includes(q)));
  return [...starts, ...contains];
}

/** Typed `/query` before the cursor: `from` is the `/`. */
export type SlashTrigger = { from: number; to: number; query: string };

const ATOM = "￼";
// `/` at the line start or after a space; the query may hold inner spaces (할 일) but
// cannot start with one.
const SLASH_RE = /(?:^|\s)\/((?:[^\s/][^/]{0,19})?)$/;

/** The open `/…` before the cursor, if any (pure; exported for tests). */
export function findSlashTrigger(state: EditorState): SlashTrigger | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  if ($from.marks().some((m) => m.type.name === "code")) return null;
  if (findWikiTrigger(state)) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, ATOM);
  const m = SLASH_RE.exec(before);
  if (!m || m[1].includes(ATOM)) return null;
  const query = m[1];
  return { from: $from.pos - query.length - 1, to: $from.pos, query };
}
