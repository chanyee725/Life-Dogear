/**
 * "이번 주 모음" for a new weekly review (PLAN-TODAY 3절): what was made, which tasks
 * were finished and which projects ended this week. Pure; the repo gathers the rows.
 * Written once into the draft when the review is created — the user edits it freely.
 */
import { cleanTitle } from "@/lib/wikilinks";

export type DraftItem = { title: string };
export type DraftTask = { title: string; parentTitle?: string | null };

export type WeekDigest = {
  /** Items created this week (not reviews), oldest first. */
  created: DraftItem[];
  /** Tasks marked done this week. */
  doneTasks: DraftTask[];
  /** Projects completed this week. */
  finishedProjects: DraftItem[];
};

/** Most lines per list; the rest is summed up as "외 n개". */
export const DRAFT_LIST_LIMIT = 20;

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Plain text that must not turn into a body link: `[[…]]` inside goes into inline code. */
const plain = (s: string) => {
  const line = oneLine(s);
  return /\[\[|\]\]/.test(line) && !line.includes("`") ? `\`${line}\`` : line;
};

/**
 * `[[제목]]` when the title can be a wiki link (no brackets, ≤ 300 chars), plain text
 * otherwise — a broken link would be worse than none.
 */
export function wikiRef(title: string): string {
  const clean = cleanTitle(title);
  return clean && !/[[\]]/.test(clean) ? `[[${clean}]]` : plain(title);
}

function bulletList(lines: string[]): string {
  const shown = lines.slice(0, DRAFT_LIST_LIMIT).map((l) => `- ${l}`);
  const rest = lines.length - shown.length;
  if (rest > 0) shown.push(`- 외 ${rest}개`);
  return shown.join("\n");
}

/** Markdown section, or "" when nothing happened this week (the draft stays plain). */
export function weekDigestMarkdown(digest: WeekDigest): string {
  const parts: string[] = [];
  if (digest.created.length) {
    parts.push(`### 만든 항목\n\n${bulletList(digest.created.map((i) => wikiRef(i.title)))}`);
  }
  if (digest.doneTasks.length) {
    const lines = digest.doneTasks.map((t) =>
      t.parentTitle ? `${plain(t.title)} · ${wikiRef(t.parentTitle)}` : plain(t.title),
    );
    parts.push(`### 완료한 할 일\n\n${bulletList(lines)}`);
  }
  if (digest.finishedProjects.length) {
    parts.push(
      `### 끝난 프로젝트\n\n${bulletList(digest.finishedProjects.map((p) => wikiRef(p.title)))}`,
    );
  }
  return parts.length ? `## 이번 주 모음\n\n${parts.join("\n\n")}\n\n` : "";
}
