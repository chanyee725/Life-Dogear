import {
  GOAL_HORIZON,
  GOAL_STATUS,
  IMPORTANCE,
  ITEM_ROUTE,
  ITEM_TYPE,
  PROJECT_KIND,
  PROJECT_STAGE,
  PROJECT_STATUS,
  READ_STATUS,
  SEMINAR_KIND,
  THOUGHT_KIND,
  THOUGHT_MATURITY,
  type BadgeTone,
  type ItemType,
} from "@/lib/enums";
import { areas, goals, papers, projects, seminars, tags, thoughts } from "@/lib/repo";
import type { TagCount } from "@/lib/repo/tags";

export type TagSort = "count" | "name";

export const parseTagSort = (value: unknown): TagSort => (value === "name" ? "name" : "count");

/** Most used first (ties by name), or alphabetical. */
export function sortTags(list: readonly TagCount[], sort: TagSort): TagCount[] {
  const byName = (a: TagCount, b: TagCount) => a.name.localeCompare(b.name, "ko");
  return [...list].sort(sort === "name" ? byName : (a, b) => b.count - a.count || byName(a, b));
}

export const tagHref = (name: string) => `/tags/${encodeURIComponent(name)}`;

/**
 * Decodes the `[name]` segment; null when it is not valid percent-encoding.
 * Relies on Next 15 handing `params` over still percent-encoded (as in the URL),
 * so this decodes exactly once; revisit if a Next upgrade starts pre-decoding.
 */
export function decodeTagParam(raw: string): string | null {
  try {
    const name = decodeURIComponent(raw).normalize("NFC").trim();
    return name || null;
  } catch {
    return null;
  }
}

export type TaggedBadge = { label: string; tone: BadgeTone };
export type TaggedItem = {
  id: string;
  href: string;
  title: string;
  badges: TaggedBadge[];
  meta?: string;
};
export type TaggedGroup = { type: ItemType; label: string; items: TaggedItem[] };
export type TagPageData = { name: string; total: number; groups: TaggedGroup[] };

const badge = <V extends string>(
  e: { label: (v: V) => string; tone: (v: V) => BadgeTone },
  value: V,
): TaggedBadge => ({ label: e.label(value), tone: e.tone(value) });

const href = (type: ItemType, id: string) => `${ITEM_ROUTE[type]}/${id}`;

/**
 * Items carrying the tag, grouped by type in sidebar order; empty groups are
 * dropped. Returns null when no item uses the tag (case-insensitive match).
 */
export async function loadTagPage(rawName: string): Promise<TagPageData | null> {
  const wanted = rawName.normalize("NFC").trim().toLowerCase();
  const tag = (await tags.listAll({ visibleOnly: true })).find(
    (t) => t.name.toLowerCase() === wanted,
  );
  if (!tag) return null;

  const [goalRows, projectRows, areaRows, paperRows, seminarRows, thoughtRows] = await Promise.all([
    goals.list({ tag: tag.name }),
    projects.list({ tag: tag.name, sort: "updated" }),
    areas.list({ tag: tag.name }),
    papers.list({ tag: tag.name, sort: "updated" }),
    seminars.list({ tag: tag.name, sort: "date" }),
    thoughts.list({ tag: tag.name, sort: "updated" }),
  ]);

  const groups: TaggedGroup[] = [
    {
      type: "goal",
      label: ITEM_TYPE.label("goal"),
      items: goalRows.map((g) => ({
        id: g.id,
        href: href("goal", g.id),
        title: g.title,
        badges: [badge(GOAL_HORIZON, g.horizon), badge(GOAL_STATUS, g.status)],
        meta: g.period ?? undefined,
      })),
    },
    {
      type: "project",
      label: ITEM_TYPE.label("project"),
      items: projectRows.map((p) => ({
        id: p.id,
        href: href("project", p.id),
        title: p.title,
        badges:
          p.kind === "research"
            ? [badge(PROJECT_STAGE, p.stage)]
            : [badge(PROJECT_KIND, p.kind), badge(PROJECT_STATUS, p.status)],
        meta: p.dueDate ? `마감 ${p.dueDate}` : undefined,
      })),
    },
    {
      type: "area",
      label: ITEM_TYPE.label("area"),
      items: areaRows.map((a) => ({
        id: a.id,
        href: href("area", a.id),
        title: a.title,
        badges: [],
        meta: a.standard || undefined,
      })),
    },
    {
      type: "paper",
      label: ITEM_TYPE.label("paper"),
      items: paperRows.map((p) => ({
        id: p.id,
        href: href("paper", p.id),
        title: p.title,
        badges: [badge(READ_STATUS, p.readStatus), badge(IMPORTANCE, p.importance)],
        meta: [p.authors.join(", "), p.year ?? ""].filter(Boolean).join(" · ") || undefined,
      })),
    },
    {
      type: "seminar",
      label: ITEM_TYPE.label("seminar"),
      items: seminarRows.map((s) => ({
        id: s.id,
        href: href("seminar", s.id),
        title: s.title,
        badges: [badge(SEMINAR_KIND, s.kind)],
        meta: [s.date ?? "", s.speaker].filter(Boolean).join(" · ") || undefined,
      })),
    },
    {
      type: "thought",
      label: ITEM_TYPE.label("thought"),
      items: thoughtRows.map((t) => ({
        id: t.id,
        href: href("thought", t.id),
        title: t.title,
        badges: [badge(THOUGHT_KIND, t.kind), badge(THOUGHT_MATURITY, t.maturity)],
      })),
    },
  ].filter((g) => g.items.length > 0) as TaggedGroup[];

  return {
    name: tag.name,
    total: groups.reduce((n, g) => n + g.items.length, 0),
    groups,
  };
}
