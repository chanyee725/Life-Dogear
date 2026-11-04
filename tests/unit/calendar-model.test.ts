import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarHref,
  countByDay,
  dayOf,
  gridRange,
  gridWeeks,
  layoutWeek,
  moveItemTo,
  parseCalendarQuery,
  rangeTitle,
  seoulDate,
  splitOverflow,
  stepDate,
  timeOf,
} from "@/components/calendar/model";
import { SOURCE_META } from "@/components/calendar/sources";
import { GRAPH_THEME_DARK, GRAPH_THEME_LIGHT } from "@/components/graph/graph-theme";
import type { CalendarItem } from "@/lib/calendar/types";

const item = (id: string, start: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id,
  source: "task",
  title: id,
  start,
  allDay: true,
  ...extra,
});

describe("Seoul dates", () => {
  it("puts instants on the Seoul day", () => {
    // 2026-11-04 15:30 UTC = 11-05 00:30 KST
    expect(seoulDate(new Date("2026-11-04T15:30:00Z"))).toBe("2026-11-05");
    expect(dayOf("2026-11-04T14:59:00Z")).toBe("2026-11-04");
    expect(dayOf("2026-11-04")).toBe("2026-11-04");
  });

  it("shows Seoul time for timed items only", () => {
    expect(timeOf({ allDay: false, start: "2026-11-04T01:05:00Z" })).toBe("10:05");
    expect(timeOf({ allDay: true, start: "2026-11-04" })).toBeNull();
  });
});

describe("grid", () => {
  it("covers the month with Monday-first weeks", () => {
    const weeks = gridWeeks("month", "2026-11-18");
    expect(weeks[0]![0]).toBe("2026-10-26");
    expect(weeks.at(-1)![6]).toBe("2026-12-06");
    expect(weeks).toHaveLength(6);
    expect(gridRange("month", "2026-02-10")).toEqual({ from: "2026-01-26", to: "2026-03-01" });
  });

  it("shows one week for the week view", () => {
    expect(gridRange("week", "2026-11-04")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(rangeTitle("week", "2026-11-04")).toBe("2026년 11월 2일 – 8일");
    expect(rangeTitle("week", "2026-12-30")).toBe("2026년 12월 28일 – 2027년 1월 3일");
    expect(rangeTitle("month", "2026-11-04")).toBe("2026년 11월");
  });

  it("steps by month (clamped) or week", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(stepDate("month", "2026-12-15", 1)).toBe("2027-01-15");
    expect(stepDate("week", "2026-11-04", -1)).toBe("2026-10-28");
  });
});

describe("query", () => {
  it("parses with safe defaults", () => {
    expect(parseCalendarQuery({}, "2026-11-04")).toEqual({
      view: "list",
      range: "month",
      date: "2026-11-04",
      papers: false,
    });
    expect(
      parseCalendarQuery(
        { view: "calendar", range: "week", date: "2026-02-30", papers: "1" },
        "2026-11-04",
      ),
    ).toMatchObject({ view: "calendar", range: "week", date: "2026-11-04", papers: true });
    expect(parseCalendarQuery({ date: "2026-12-01" }, "2026-11-04").date).toBe("2026-12-01");
  });

  it("builds short links", () => {
    expect(calendarHref({ range: "month", date: "2026-11-04" }, "2026-11-04")).toBe(
      "/tasks?view=calendar",
    );
    expect(calendarHref({ range: "week", date: "2026-11-10", papers: true })).toBe(
      "/tasks?view=calendar&range=week&date=2026-11-10&papers=1",
    );
  });
});

describe("layoutWeek", () => {
  const days = gridWeeks("week", "2026-11-04")[0]!;

  it("packs bars into lanes and clips them to the week", () => {
    const l = layoutWeek(
      [
        item("goal", "2026-10-01", { source: "goal", end: "2026-12-31" }),
        item("rev", "2026-11-02", { source: "review", end: "2026-11-04" }),
        item("rev2", "2026-11-05", { source: "review", end: "2026-11-08" }),
        item("t", "2026-11-04"),
        item("out", "2026-11-20"),
      ],
      days,
    );
    expect(l.lanes).toBe(2);
    const goal = l.bars.find((b) => b.item.id === "goal")!;
    expect(goal).toMatchObject({ col: 0, span: 7, continuesBefore: true, continuesAfter: true });
    const rev = l.bars.find((b) => b.item.id === "rev")!;
    const rev2 = l.bars.find((b) => b.item.id === "rev2")!;
    expect(rev.lane).toBe(rev2.lane); // reuse a lane once free
    expect(rev2).toMatchObject({ col: 3, span: 4 });
    expect(l.singles[2]!.map((i) => i.id)).toEqual(["t"]);
    expect(l.singles.flat()).toHaveLength(1);
  });

  it("sorts a day: all-day, then by time, then source", () => {
    const l = layoutWeek(
      [
        item("g2", "2026-11-04T05:00:00Z", { source: "google", allDay: false }),
        item("g1", "2026-11-04T01:00:00Z", { source: "google", allDay: false }),
        item("p", "2026-11-04", { source: "project" }),
        item("t", "2026-11-04"),
      ],
      days,
    );
    expect(l.singles[2]!.map((i) => i.id)).toEqual(["t", "p", "g1", "g2"]);
  });
});

describe("overflow and counts", () => {
  it("hides at least two behind +n", () => {
    expect(splitOverflow([1, 2, 3], 3)).toEqual({ shown: [1, 2, 3], hidden: 0 });
    expect(splitOverflow([1, 2, 3, 4], 3)).toEqual({ shown: [1, 2], hidden: 2 });
  });

  it("counts bars on every covered day", () => {
    const days = ["2026-11-02", "2026-11-03", "2026-11-04"];
    const m = countByDay(
      [item("r", "2026-11-01", { end: "2026-11-03", source: "review" }), item("t", "2026-11-03")],
      days,
    );
    expect(m.get("2026-11-02")!.length).toBe(1);
    expect(m.get("2026-11-03")!.length).toBe(2);
    expect(m.get("2026-11-04")!.length).toBe(0);
  });

  it("moves an item to another day", () => {
    const moved = moveItemTo([item("a", "2026-11-04"), item("b", "2026-11-05")], "a", "2026-11-09");
    expect(moved[0]!.start).toBe("2026-11-09");
    expect(moved[1]!.start).toBe("2026-11-05");
  });
});

describe("source colors", () => {
  it("reuse the graph kind colors", () => {
    for (const s of ["task", "project", "seminar", "review", "goal", "paper"] as const) {
      expect(SOURCE_META[s].light).toBe(GRAPH_THEME_LIGHT.kind[s]);
      expect(SOURCE_META[s].dark).toBe(GRAPH_THEME_DARK.kind[s]);
    }
  });

  it("tell sources apart by shape or word, not color only", () => {
    const keys = Object.values(SOURCE_META).map((m) => `${m.shape}:${m.label}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(Object.values(SOURCE_META).map((m) => m.label)).size).toBe(7);
  });
});
