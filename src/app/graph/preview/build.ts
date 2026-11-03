/**
 * Preview content for the graph's side panel, built from an item row. Pure: the route
 * loads the row, this decides which 2–3 properties and which summary line to show
 * (docs/design/graph.md 6.4).
 */
import type { NodePreview } from "@/components/graph/preview-types";
import {
  PROJECT_STAGE,
  PROJECT_STATUS,
  READ_STATUS,
  SEMINAR_KIND,
  THOUGHT_KIND,
  THOUGHT_MATURITY,
} from "@/lib/enums";

const SUMMARY_MAX = 160;

/** First paragraph of a markdown body as plain text, cut to 160 chars. */
export function firstParagraph(body: string | null | undefined): string | undefined {
  if (!body) return undefined;
  const text = body
    .replace(/\r\n?/g, "\n")
    // Fenced code blocks are not prose.
    .replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?(^\s*\1[^\n]*$|(?![\s\S]))/gm, "");
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block
      .split("\n")
      // Headings, table rows and rules are not a summary.
      .filter((line) => !/^\s{0,3}(#{1,6}\s|\||(-{3,}|\*{3,}|_{3,})\s*$)/.test(line))
      .map((line) => line.replace(/^\s{0,3}(>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, ""));
    const plain = lines
      .join(" ")
      .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (plain) return clip(plain);
  }
  return undefined;
}

function clip(text: string): string {
  const t = text.trim();
  return t.length > SUMMARY_MAX ? `${t.slice(0, SUMMARY_MAX - 1)}…` : t;
}

const nonEmpty = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

type Prop = NodePreview["props"][number];
const prop = (label: string, value: string | null | undefined): Prop[] =>
  nonEmpty(value) ? [{ label, value: value.trim() }] : [];

export type ProjectRow = {
  kind: string;
  status: string;
  stage: string;
  dueDate: string | null;
  nextAction: string;
  researchQuestion: string;
  body: string;
  archivedAt: string | null;
};
export type PaperRow = {
  authors: string[];
  year: number | null;
  readStatus: string;
  summary: string;
  body: string;
  archivedAt: string | null;
};
export type SeminarRow = {
  date: string | null;
  speaker: string;
  kind: string;
  keyLine: string;
  body: string;
  archivedAt: string | null;
};
export type ThoughtRow = {
  kind: string;
  maturity: string;
  body: string;
  archivedAt: string | null;
};
export type AreaRow = { standard: string; body: string; archivedAt: string | null };

const label = <V extends string>(
  e: { is: (v: unknown) => v is V; label: (v: V) => string },
  v: string,
) => (e.is(v) ? e.label(v) : v);

export function projectPreview(p: ProjectRow): NodePreview {
  return {
    archived: !!p.archivedAt,
    props: [
      ...(p.kind === "research"
        ? prop("단계", label(PROJECT_STAGE, p.stage))
        : prop("상태", label(PROJECT_STATUS, p.status))),
      ...prop("마감일", p.dueDate),
    ],
    summary: nonEmpty(p.nextAction)
      ? clip(`다음 할 일: ${p.nextAction}`)
      : nonEmpty(p.researchQuestion)
        ? clip(p.researchQuestion)
        : firstParagraph(p.body),
  };
}

export function paperPreview(p: PaperRow): NodePreview {
  const authors =
    p.authors.length > 2
      ? `${p.authors.slice(0, 2).join(", ")} 외 ${p.authors.length - 2}명`
      : p.authors.join(", ");
  return {
    archived: !!p.archivedAt,
    props: [
      ...prop("저자", authors),
      ...prop("연도", p.year ? String(p.year) : null),
      ...prop("읽기", label(READ_STATUS, p.readStatus)),
    ],
    summary: nonEmpty(p.summary) ? clip(p.summary) : firstParagraph(p.body),
  };
}

export function seminarPreview(s: SeminarRow): NodePreview {
  return {
    archived: !!s.archivedAt,
    badge: s.kind !== "seminar" && SEMINAR_KIND.is(s.kind) ? SEMINAR_KIND.label(s.kind) : undefined,
    props: [...prop("날짜", s.date), ...prop("연사", s.speaker)],
    summary: nonEmpty(s.keyLine) ? clip(s.keyLine) : firstParagraph(s.body),
  };
}

export function thoughtPreview(t: ThoughtRow): NodePreview {
  return {
    archived: !!t.archivedAt,
    props: [
      ...prop("종류", label(THOUGHT_KIND, t.kind)),
      ...prop("발전", label(THOUGHT_MATURITY, t.maturity)),
    ],
    summary: firstParagraph(t.body),
  };
}

export function areaPreview(a: AreaRow, projectCount: number): NodePreview {
  return {
    archived: !!a.archivedAt,
    props: [{ label: "프로젝트", value: `${projectCount}개` }],
    summary: nonEmpty(a.standard) ? clip(a.standard) : firstParagraph(a.body),
  };
}
