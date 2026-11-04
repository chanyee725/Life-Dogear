/**
 * "이번 주 모음" for a new weekly review (PLAN-TODAY 3절, docs/design/today.md 5절):
 * tasks finished, projects ended and items made this week. Pure; the repo gathers the rows.
 * Written once, before "## 회고 메모", when the review is created — the user edits it freely.
 * Plain text only: no `[[links]]` (one draft would add dozens of body links to the graph).
 */
import { ITEM_TYPE, type ItemType } from "@/lib/enums";

export type DraftTask = { title: string; parentTitle?: string | null };
export type DraftItem = { type: ItemType; title: string };

export type WeekDigest = {
  /** Tasks marked done this week, by completion time. */
  doneTasks: DraftTask[];
  /** Projects completed this week, by completion time. */
  finishedProjects: { title: string }[];
  /** Items created this week (not tasks or reviews), in creation order. */
  created: DraftItem[];
};

/** Most lines per group; the rest is summed up as "외 n개". */
export const DRAFT_LIST_LIMIT = 15;

/** Order of the "새로 만든 항목" group by kind. */
export const CREATED_KIND_ORDER: readonly ItemType[] = [
  "paper",
  "note",
  "seminar",
  "thought",
  "project",
  "goal",
  "area",
];

/**
 * One line of plain Markdown: whitespace collapsed, and characters that would turn into
 * links, emphasis or headings escaped. Escaped `\[\[…\]\]` still counts as a wiki link, so
 * double brackets are split with a space.
 */
export function plainTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\[(?=\[)/g, "[ ")
    .replace(/\](?=\])/g, "] ")
    .replace(/[\\[\]*_`<>]/g, (c) => `\\${c}`)
    .replace(/^#/, "\\#");
}

function group(heading: string, lines: string[]): string {
  if (!lines.length) return "";
  const shown = lines.slice(0, DRAFT_LIST_LIMIT).map((l) => `- ${l}`);
  const rest = lines.length - shown.length;
  if (rest > 0) shown.push(`- 외 ${rest}개`);
  return `### ${heading} ${lines.length}\n${shown.join("\n")}`;
}

const kindRank = (t: ItemType) => {
  const i = CREATED_KIND_ORDER.indexOf(t);
  return i === -1 ? CREATED_KIND_ORDER.length : i;
};

/** Markdown section ending in a blank line, or "" when nothing happened this week. */
export function weekDigestMarkdown(digest: WeekDigest): string {
  const created = digest.created
    .map((item, i) => ({ item, i }))
    .sort((a, b) => kindRank(a.item.type) - kindRank(b.item.type) || a.i - b.i)
    .map(({ item }) => `${ITEM_TYPE.label(item.type)} · ${plainTitle(item.title)}`);
  const groups = [
    group(
      "완료한 할 일",
      digest.doneTasks.map((t) =>
        t.parentTitle
          ? `${plainTitle(t.title)} — ${plainTitle(t.parentTitle)}`
          : plainTitle(t.title),
      ),
    ),
    group(
      "끝난 프로젝트",
      digest.finishedProjects.map((p) => plainTitle(p.title)),
    ),
    group("새로 만든 항목", created),
  ].filter(Boolean);
  if (!groups.length) return "";
  return `## 이번 주 모음\n\n${groups.join("\n\n")}\n\n`;
}
