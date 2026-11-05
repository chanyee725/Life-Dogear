import type { BadgeTone } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import type { SearchHit, SearchHitType } from "@/lib/search/types";

/** Window event that opens the palette (e.g. from a sidebar "검색" button). */
export const OPEN_PALETTE_EVENT = "research-brain:open-search";

export const SEARCH_DEBOUNCE_MS = 150;

export type PaletteKeyEvent = {
  key: string;
  /** Physical key; lets Cmd+K work while a Korean input mode turns `key` into "ㅏ". */
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

/**
 * Cmd+K / Cmd+/ (macOS) or Ctrl+K / Ctrl+/ (elsewhere). Works while typing (also in the
 * editor), unlike single-key shortcuts; a bare "/" stays the home quick-input shortcut.
 */
export function isPaletteShortcut(e: PaletteKeyEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  // "/" needs Shift on some layouts (e.g. German Shift+7), so allow Shift when key is "/".
  if (e.key === "/") return true;
  if (e.shiftKey) return false;
  return e.key === "k" || e.key === "K" || e.code === "KeyK" || e.code === "Slash";
}

export function typeLabel(type: SearchHitType): string {
  if (type === "task") return "할 일";
  return type === "highlight" ? "하이라이트" : ITEM_TYPE.label(type);
}

/** Highlight badge tone; must differ from every `ITEM_TYPE` tone (area took "rose" in 1.5). */
export const HIGHLIGHT_TONE: BadgeTone = "green";

export function typeTone(type: SearchHitType): BadgeTone {
  if (type === "task") return "gray";
  return type === "highlight" ? HIGHLIGHT_TONE : ITEM_TYPE.tone(type);
}

/** Short hint for where a non-title match was found. */
export function fieldHint(hit: SearchHit): string | null {
  if (hit.type === "highlight") return hit.page ? `${hit.page}쪽` : null;
  if (hit.type === "task") return hit.parentTitle ?? null;
  switch (hit.field) {
    case "meta":
      return "정보";
    case "body":
      return "본문";
    default:
      return null;
  }
}

export type HitGroup = { type: SearchHitType; label: string; tone: BadgeTone; hits: SearchHit[] };

/**
 * Groups ranked hits by type. Groups appear in the order of their best hit, so the
 * top-ranked result stays first; `flat` is the display order used for ↑/↓.
 */
export function groupHits(hits: readonly SearchHit[]): { groups: HitGroup[]; flat: SearchHit[] } {
  const byType = new Map<SearchHitType, HitGroup>();
  for (const hit of hits) {
    let group = byType.get(hit.type);
    if (!group) {
      group = { type: hit.type, label: typeLabel(hit.type), tone: typeTone(hit.type), hits: [] };
      byType.set(hit.type, group);
    }
    group.hits.push(hit);
  }
  const groups = [...byType.values()];
  return { groups, flat: groups.flatMap((g) => g.hits) };
}

/** Next active index for ↑/↓, wrapping around; -1 when the list is empty. */
export function moveActive(index: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (index < 0) return delta > 0 ? 0 : count - 1;
  return (((index + delta) % count) + count) % count;
}

export const hitKey = (hit: SearchHit): string => `${hit.type}:${hit.id}`;

/** A palette command (not a search hit): runs an action instead of opening a page. */
export type PaletteCommand = {
  id: "capture";
  label: string;
  /** Single-key shortcut shown on the right. */
  shortcut: string;
  /** Lower-case words the query is matched against. */
  keywords: readonly string[];
};

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { id: "capture", label: "빠른 캡처", shortcut: "C", keywords: ["빠른 캡처", "캡처", "capture"] },
];

/**
 * Commands for a query: all of them when empty, else those with a keyword (or a word of
 * one) that starts with the query, from 2 characters on — so a lone "a" or "c" does not
 * pull 캡처 to the top of ordinary searches.
 */
export function matchCommands(query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PALETTE_COMMANDS];
  if (q.length < 2) return [];
  return PALETTE_COMMANDS.filter((c) =>
    c.keywords.some((k) => k.startsWith(q) || k.split(" ").some((w) => w.startsWith(q))),
  );
}
