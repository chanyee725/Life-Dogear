/**
 * Data for `/resources` (자료): topics first, then — for a chosen topic — its papers,
 * seminars, thoughts and notes in one list, most recently updated first; with no topic, the
 * most recently updated resources. Archived items are left out (repo default). Topics
 * come from those same items, so tags used only by projects, areas or goals do not show.
 * Fixed query count: four lists (each with its tags).
 */
import {
  ITEM_ROUTE,
  NOTE_SOURCE_KIND,
  READ_STATUS,
  SEMINAR_KIND,
  THOUGHT_KIND,
  type BadgeTone,
} from "@/lib/enums";
import { notes, papers, seminars, thoughts } from "@/lib/repo";
import type { TagCount } from "@/lib/repo/tags";
import type { TopicSort } from "./topic-index";

export * from "./topic-index";

export type ResourceType = "paper" | "seminar" | "thought" | "note";

export type ResourceItem = {
  type: ResourceType;
  id: string;
  href: string;
  title: string;
  /** Secondary line, e.g. "김가명 외 1명 · 2024". */
  meta?: string;
  status?: { label: string; tone: BadgeTone };
  updatedAt: string;
};

export type ResourcesData = {
  topics: TagCount[];
  /** The chosen topic as stored (original case); null when none or unknown. */
  topic: string | null;
  /** `?topic=` was given but no visible item uses it. */
  unknownTopic: boolean;
  items: ResourceItem[];
  /** With no topic chosen: the most recently updated resources (all topics). */
  recent: ResourceItem[];
};

/** How many resources "최근 자료" shows when no topic is chosen. */
export const RECENT_LIMIT = 20;

/** Tab order follows the sidebar (노트 right after 논문). */
export const RESOURCE_TYPES = ["paper", "note", "seminar", "thought"] as const;

/** `?type=` value: paper | seminar | thought | note; anything else means all. */
export function parseTypeParam(value: unknown): ResourceType | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return (RESOURCE_TYPES as readonly unknown[]).includes(raw) ? (raw as ResourceType) : null;
}

/** Items per type, for the type tabs. */
export function countByType(
  items: readonly { type: ResourceType }[],
): Record<ResourceType, number> {
  const counts: Record<ResourceType, number> = {
    paper: 0,
    seminar: 0,
    thought: 0,
    note: 0,
  };
  for (const item of items) counts[item.type] += 1;
  return counts;
}

export function filterByType<T extends { type: ResourceType }>(
  items: readonly T[],
  type: ResourceType | null,
): T[] {
  return type ? items.filter((i) => i.type === type) : [...items];
}

/** `?topic=` value: first string, NFC, trimmed; null when empty. */
export function parseTopicParam(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim();
  return name && name.length <= 100 ? name : null;
}

/** Case-insensitive topic lookup. */
export function findTopic(topics: readonly TagCount[], wanted: string): TagCount | null {
  const w = wanted.normalize("NFC").trim().toLowerCase();
  return topics.find((t) => t.name.toLowerCase() === w) ?? null;
}

/**
 * Topics used by the given (non-archived) resources, with how many carry each, by name.
 * Tag names are unique regardless of case, so one tag has one spelling everywhere.
 */
export function collectTopics(rows: readonly { tags: readonly string[] }[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const name of new Set(row.tags)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

const hasTag = (row: { tags: readonly string[] }, lower: string) =>
  row.tags.some((t) => t.toLowerCase() === lower);

/** `/resources` link; default sort (`count`) and no type are left out of the URL. */
export function resourcesHref(
  topic?: string | null,
  opts: { type?: ResourceType | null; sort?: TopicSort } = {},
): string {
  const parts: string[] = [];
  if (topic) parts.push(`topic=${encodeURIComponent(topic)}`);
  if (topic && opts.type) parts.push(`type=${opts.type}`);
  if (opts.sort === "name") parts.push("sort=name");
  return parts.length ? `/resources?${parts.join("&")}` : "/resources";
}

type PaperLike = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  readStatus: string;
  updatedAt: string;
};
type SeminarLike = {
  id: string;
  title: string;
  date: string | null;
  speaker: string;
  kind: string;
  updatedAt: string;
};
type ThoughtLike = { id: string; title: string; kind: string; updatedAt: string };
type NoteLike = {
  id: string;
  title: string;
  sourceKind: string | null;
  sourceTitle: string | null;
  updatedAt: string;
};

function authorsLine(authors: readonly string[]): string {
  if (authors.length <= 1) return authors[0] ?? "";
  return `${authors[0]} 외 ${authors.length - 1}명`;
}

const join = (...parts: (string | null | undefined)[]) =>
  parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ") || undefined;

/** One list of the four kinds, newest update first (ties: kind order, then title). */
export function mergeResources(
  paperRows: readonly PaperLike[],
  seminarRows: readonly SeminarLike[],
  thoughtRows: readonly ThoughtLike[],
  noteRows: readonly NoteLike[] = [],
): ResourceItem[] {
  const items: ResourceItem[] = [
    ...paperRows.map((p) => ({
      type: "paper" as const,
      id: p.id,
      href: `${ITEM_ROUTE.paper}/${p.id}`,
      title: p.title,
      meta: join(authorsLine(p.authors), p.year ? String(p.year) : null),
      status: READ_STATUS.is(p.readStatus)
        ? { label: READ_STATUS.label(p.readStatus), tone: READ_STATUS.tone(p.readStatus) }
        : undefined,
      updatedAt: p.updatedAt,
    })),
    ...seminarRows.map((s) => ({
      type: "seminar" as const,
      id: s.id,
      href: `${ITEM_ROUTE.seminar}/${s.id}`,
      title: s.title,
      meta: join(
        s.date,
        s.speaker,
        SEMINAR_KIND.is(s.kind) && s.kind !== "seminar" ? SEMINAR_KIND.label(s.kind) : null,
      ),
      updatedAt: s.updatedAt,
    })),
    ...thoughtRows.map((t) => ({
      type: "thought" as const,
      id: t.id,
      href: `${ITEM_ROUTE.thought}/${t.id}`,
      title: t.title,
      meta: THOUGHT_KIND.is(t.kind) ? THOUGHT_KIND.label(t.kind) : undefined,
      updatedAt: t.updatedAt,
    })),
    ...noteRows.map((n) => ({
      type: "note" as const,
      id: n.id,
      href: `${ITEM_ROUTE.note}/${n.id}`,
      title: n.title,
      // e.g. "책 · 데이터 중심 애플리케이션 설계"
      meta: join(
        n.sourceKind && NOTE_SOURCE_KIND.is(n.sourceKind)
          ? NOTE_SOURCE_KIND.label(n.sourceKind)
          : null,
        n.sourceTitle,
      ),
      updatedAt: n.updatedAt,
    })),
  ];
  const order: Record<ResourceType, number> = { paper: 0, note: 1, seminar: 2, thought: 3 };
  return items.sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) ||
      order[a.type] - order[b.type] ||
      a.title.localeCompare(b.title, "ko"),
  );
}

export async function loadResources(rawTopic: string | null): Promise<ResourcesData> {
  const [paperRows, seminarRows, thoughtRows, noteRows] = await Promise.all([
    papers.list(),
    seminars.list(),
    thoughts.list(),
    notes.list(),
  ]);
  const topics = collectTopics([...paperRows, ...seminarRows, ...thoughtRows, ...noteRows]);
  const latest = () =>
    mergeResources(paperRows, seminarRows, thoughtRows, noteRows).slice(0, RECENT_LIMIT);
  if (!rawTopic) return { topics, topic: null, unknownTopic: false, items: [], recent: latest() };
  const found = findTopic(topics, rawTopic);
  if (!found) return { topics, topic: null, unknownTopic: true, items: [], recent: [] };
  const lower = found.name.toLowerCase();
  return {
    topics,
    topic: found.name,
    unknownTopic: false,
    recent: [],
    items: mergeResources(
      paperRows.filter((r) => hasTag(r, lower)),
      seminarRows.filter((r) => hasTag(r, lower)),
      thoughtRows.filter((r) => hasTag(r, lower)),
      noteRows.filter((r) => hasTag(r, lower)),
    ),
  };
}
