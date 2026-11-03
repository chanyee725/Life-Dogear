/**
 * Data for `/resources` (자료): topics first, then — for a chosen topic — its papers,
 * seminars and thoughts in one list, most recently updated first. Archived items are
 * left out (repo default). Fixed query count: one for the topics, three lists per topic.
 */
import { ITEM_ROUTE, READ_STATUS, SEMINAR_KIND, THOUGHT_KIND, type BadgeTone } from "@/lib/enums";
import { papers, seminars, tags, thoughts } from "@/lib/repo";
import type { TagCount } from "@/lib/repo/tags";

export type ResourceType = "paper" | "seminar" | "thought";

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
};

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

export const resourcesHref = (topic?: string | null) =>
  topic ? `/resources?topic=${encodeURIComponent(topic)}` : "/resources";

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

function authorsLine(authors: readonly string[]): string {
  if (authors.length <= 1) return authors[0] ?? "";
  return `${authors[0]} 외 ${authors.length - 1}명`;
}

const join = (...parts: (string | null | undefined)[]) =>
  parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ") || undefined;

/** One list of the three kinds, newest update first (ties: kind order, then title). */
export function mergeResources(
  paperRows: readonly PaperLike[],
  seminarRows: readonly SeminarLike[],
  thoughtRows: readonly ThoughtLike[],
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
  ];
  const order: Record<ResourceType, number> = { paper: 0, seminar: 1, thought: 2 };
  return items.sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) ||
      order[a.type] - order[b.type] ||
      a.title.localeCompare(b.title, "ko"),
  );
}

export async function loadResources(rawTopic: string | null): Promise<ResourcesData> {
  const topics = await tags.listAll({ visibleOnly: true });
  if (!rawTopic) return { topics, topic: null, unknownTopic: false, items: [] };
  const found = findTopic(topics, rawTopic);
  if (!found) return { topics, topic: null, unknownTopic: true, items: [] };
  const [paperRows, seminarRows, thoughtRows] = await Promise.all([
    papers.list({ tag: found.name }),
    seminars.list({ tag: found.name }),
    thoughts.list({ tag: found.name }),
  ]);
  return {
    topics,
    topic: found.name,
    unknownTopic: false,
    items: mergeResources(paperRows, seminarRows, thoughtRows),
  };
}
