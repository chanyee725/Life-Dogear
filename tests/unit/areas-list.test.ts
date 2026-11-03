import { describe, expect, it } from "vitest";
import { careSignal, daysSince, filterAreas, parseAreaSort, sortAreas } from "@/app/areas/list";

const now = new Date("2026-11-03T12:00:00.000Z");
const ago = (days: number, hours = 0) =>
  new Date(now.getTime() - (days * 24 + hours) * 3_600_000).toISOString();

describe("areas list sort param", () => {
  it("defaults to the sidebar order", () => {
    expect(parseAreaSort(undefined)).toBe("order");
    expect(parseAreaSort("bogus")).toBe("order");
    expect(parseAreaSort("recent")).toBe("recent");
    expect(parseAreaSort("stale")).toBe("stale");
  });
});

describe("care signal", () => {
  it("counts whole days and never goes negative", () => {
    expect(daysSince(ago(0, 23), now)).toBe(0);
    expect(daysSince(ago(3, 1), now)).toBe(3);
    expect(daysSince(ago(-1), now)).toBe(0);
  });

  it("stays quiet up to 14 days, then flags the area", () => {
    expect(careSignal(ago(0, 3), now)).toEqual({ stale: false, label: "3시간 전" });
    expect(careSignal(ago(3), now)).toEqual({ stale: false, label: "3일 전" });
    expect(careSignal(ago(14, 5), now)).toEqual({ stale: false, label: "14일 전" });
    expect(careSignal(ago(21), now)).toEqual({ stale: true, label: "21일째 손대지 않음" });
  });
});

describe("filterAreas", () => {
  const rows = [
    { title: "연구 분야", standard: "새 논문·세미나를 꾸준히 따라간다." },
    { title: "건강", standard: "잠·운동·식사를 무너뜨리지 않는다." },
    { title: "English", standard: "" },
  ];

  it("matches title or 유지 기준, every word, ignoring case", () => {
    expect(filterAreas(rows, "").map((r) => r.title)).toEqual(["연구 분야", "건강", "English"]);
    expect(filterAreas(rows, "논문").map((r) => r.title)).toEqual(["연구 분야"]);
    expect(filterAreas(rows, "  운동 잠 ").map((r) => r.title)).toEqual(["건강"]);
    expect(filterAreas(rows, "english").map((r) => r.title)).toEqual(["English"]);
    expect(filterAreas(rows, "운동 논문")).toEqual([]);
  });
});

describe("sortAreas", () => {
  const rows = [
    { id: "a", lastActivity: ago(2) },
    { id: "b", lastActivity: ago(30) },
    { id: "c", lastActivity: ago(2) },
    { id: "d", lastActivity: ago(0, 1) },
  ];

  it("keeps the sidebar order, or sorts by activity with ties in sidebar order", () => {
    expect(sortAreas(rows, "order").map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(sortAreas(rows, "recent").map((r) => r.id)).toEqual(["d", "a", "c", "b"]);
    expect(sortAreas(rows, "stale").map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
  });
});
