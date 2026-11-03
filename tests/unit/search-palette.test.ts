import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { CommandPalette, SearchButton } from "@/components/search";
import {
  fieldHint,
  groupHits,
  isPaletteShortcut,
  moveActive,
  typeLabel,
  typeTone,
} from "@/components/search/palette";
import { ITEM_TYPE } from "@/lib/enums";
import type { SearchHit } from "@/lib/search/types";

const key = (over: Partial<Parameters<typeof isPaletteShortcut>[0]>) => ({
  key: "k",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

const hit = (type: SearchHit["type"], id: string, over: Partial<SearchHit> = {}): SearchHit => ({
  type,
  id,
  title: id,
  snippet: null,
  field: "title",
  href: `/${type}/${id}`,
  score: 0,
  archived: false,
  ...over,
});

describe("isPaletteShortcut", () => {
  it("accepts Cmd+K and Ctrl+K, including a Korean keyboard layout", () => {
    expect(isPaletteShortcut(key({ metaKey: true }))).toBe(true);
    expect(isPaletteShortcut(key({ ctrlKey: true, key: "K" }))).toBe(true);
    expect(isPaletteShortcut(key({ metaKey: true, key: "ㅏ", code: "KeyK" }))).toBe(true);
  });

  it("rejects plain K and other modifier combos", () => {
    expect(isPaletteShortcut(key({}))).toBe(false);
    expect(isPaletteShortcut(key({ metaKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isPaletteShortcut(key({ metaKey: true, key: "j", code: "KeyJ" }))).toBe(false);
  });
});

describe("groupHits", () => {
  it("groups by type in order of each group's best hit and flattens in display order", () => {
    const hits = [
      hit("paper", "p1"),
      hit("thought", "t1"),
      hit("paper", "p2"),
      hit("highlight", "h1"),
    ];
    const { groups, flat } = groupHits(hits);
    expect(groups.map((g) => [g.label, g.hits.map((h) => h.id)])).toEqual([
      ["논문", ["p1", "p2"]],
      ["생각", ["t1"]],
      ["하이라이트", ["h1"]],
    ]);
    expect(flat.map((h) => h.id)).toEqual(["p1", "p2", "t1", "h1"]);
  });
});

describe("moveActive", () => {
  it("wraps around and handles empty lists", () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });
});

describe("type tones", () => {
  it("gives every result type its own badge tone", () => {
    const types = [...ITEM_TYPE.values, "highlight" as const];
    const tones = types.map((t) => typeTone(t));
    expect(new Set(tones).size).toBe(types.length);
    expect(typeTone("highlight")).toBe("green");
  });
});

describe("labels", () => {
  it("names types and match locations in Korean", () => {
    // 1.5 renamed "연구" to "프로젝트" in ITEM_TYPE; areas come from the same enum.
    expect(typeLabel("project")).toBe("프로젝트");
    expect(typeLabel("area")).toBe("영역");
    expect(typeLabel("highlight")).toBe("하이라이트");
    expect(fieldHint(hit("highlight", "h", { page: 4, field: "highlight" }))).toBe("4쪽");
    expect(fieldHint(hit("paper", "p", { field: "body" }))).toBe("본문");
    expect(fieldHint(hit("paper", "p", { field: "meta" }))).toBe("정보");
    expect(fieldHint(hit("paper", "p"))).toBeNull();
  });
});

describe("CommandPalette", () => {
  it("renders a closed, labelled dialog on the server", () => {
    const html = renderToStaticMarkup(createElement(CommandPalette));
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="전체 검색"');
    expect(html).not.toContain("open=");
  });
});

describe("SearchButton", () => {
  it("renders a Korean label with the shortcut hint", () => {
    const html = renderToStaticMarkup(createElement(SearchButton));
    expect(html).toContain("검색");
    expect(html).toContain('aria-label="단축키 Ctrl K"');
  });
});

describe("palette commands", () => {
  it("lists 빠른 캡처 when empty or matching, not for other queries", async () => {
    const { matchCommands } = await import("@/components/search/palette");
    expect(matchCommands("").map((c) => c.id)).toEqual(["capture"]);
    expect(matchCommands("캡처").map((c) => c.id)).toEqual(["capture"]);
    expect(matchCommands(" Capt ").map((c) => c.id)).toEqual(["capture"]);
    expect(matchCommands("빠른").map((c) => c.id)).toEqual(["capture"]);
    expect(matchCommands("논문")).toEqual([]);
    // Prefix only: a single letter inside a keyword does not match.
    expect(matchCommands("a")).toEqual([]);
    expect(matchCommands("pt")).toEqual([]);
    expect(matchCommands("처")).toEqual([]);
    expect(matchCommands("c")).toEqual([]);
    expect(matchCommands("캡")).toEqual([]);
    expect(matchCommands("ca").map((c) => c.id)).toEqual(["capture"]);
  });
});
