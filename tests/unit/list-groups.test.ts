import { describe, expect, it } from "vitest";
import { groupByKey, groupByMonth, groupByYear, parseGroup } from "@/components/list/groups";

const keys = (groups: { key: string; items: unknown[] }[]) =>
  groups.map((g) => `${g.key}:${g.items.length}`);

describe("groupByKey", () => {
  const order = [
    { value: "reading", label: "읽는 중" },
    { value: "to_read", label: "읽을 예정" },
    { value: "done", label: "다 읽음" },
  ];

  it("follows the given order, drops empty groups and keeps item order", () => {
    const items = [
      { id: "a", s: "done" },
      { id: "b", s: "reading" },
      { id: "c", s: "done" },
    ];
    const groups = groupByKey(items, (i) => i.s, order);
    expect(keys(groups)).toEqual(["reading:1", "done:2"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["a", "c"]);
    expect(groups[0].label).toBe("읽는 중");
  });

  it("puts unknown keys in a trailing 기타 group", () => {
    const groups = groupByKey([{ s: "x" }, { s: "done" }], (i) => i.s, order);
    expect(groups.map((g) => g.label)).toEqual(["다 읽음", "기타"]);
  });

  it("returns no groups for no items", () => {
    expect(groupByKey([], () => "done", order)).toEqual([]);
  });
});

describe("groupByYear", () => {
  it("orders years newest first and puts missing years last", () => {
    const groups = groupByYear([{ y: 2021 }, { y: null }, { y: 2024 }, { y: 2021 }], (i) => i.y);
    expect(groups.map((g) => g.label)).toEqual(["2024년", "2021년", "연도 없음"]);
    expect(keys(groups)).toEqual(["2024:1", "2021:2", "none:1"]);
  });
});

describe("groupByMonth", () => {
  const today = "2026-11-03";

  it("splits upcoming, months newest first, and undated", () => {
    const items = [
      { d: "2026-11-10" },
      { d: "2026-10-20" },
      { d: null },
      { d: "2026-11-03" },
      { d: "2025-12-31" },
    ];
    const groups = groupByMonth(items, (i) => i.d, today);
    expect(groups.map((g) => g.label)).toEqual([
      "다가오는 일정",
      "2026년 11월",
      "2026년 10월",
      "2025년 12월",
      "날짜 없음",
    ]);
  });

  it("treats today as this month, not upcoming", () => {
    const groups = groupByMonth([{ d: today }], (i) => i.d, today);
    expect(groups.map((g) => g.key)).toEqual(["2026-11"]);
  });

  it("files malformed dates under 날짜 없음", () => {
    const groups = groupByMonth([{ d: "soon" }], (i) => i.d, today);
    expect(groups.map((g) => g.key)).toEqual(["none"]);
  });
});

describe("parseGroup", () => {
  const options = [{ value: "status" }, { value: "none" }] as const;
  it("accepts known values and falls back otherwise", () => {
    expect(parseGroup("none", options, "status")).toBe("none");
    expect(parseGroup("bogus", options, "status")).toBe("status");
    expect(parseGroup(undefined, options, "status")).toBe("status");
  });
});
