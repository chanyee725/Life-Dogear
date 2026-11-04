import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarHref,
  compareItems,
  dayDots,
  dayOf,
  gridRange,
  gridWeeks,
  isMovable,
  itemsOn,
  layoutWeek,
  moveItemTo,
  navDay,
  nextMonday,
  parseCalendarQuery,
  rangeTitle,
  seoulDate,
  splitPeriodLine,
  stepDate,
  timeOf,
  visibleSpan,
} from "@/components/calendar/model";
import {
  DEFAULT_SOURCES,
  SOURCES,
  noneChosen,
  parseSources,
  visibleItems,
} from "@/components/calendar/sources";
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
    expect(dayOf("2026-11-03T23:30:00+09:00")).toBe("2026-11-03");
    expect(dayOf("2026-11-04")).toBe("2026-11-04");
  });

  it("shows Seoul time for timed items only", () => {
    expect(timeOf({ allDay: false, start: "2026-11-04T01:05:00Z" })).toBe("10:05");
    expect(timeOf({ allDay: false, start: "2026-11-03T14:00:00+09:00" })).toBe("14:00");
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
    expect(visibleSpan("month", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("titles a month or a week", () => {
    expect(gridRange("week", "2026-11-04")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(rangeTitle("week", "2026-11-04")).toBe("11월 2일 – 8일");
    expect(rangeTitle("week", "2026-10-28")).toBe("10월 26일 – 11월 1일");
    expect(rangeTitle("month", "2026-11-04")).toBe("2026년 11월");
  });

  it("steps by month (clamped) or week", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(stepDate("month", "2026-12-15", 1)).toBe("2027-01-15");
    expect(stepDate("week", "2026-11-04", -1)).toBe("2026-10-28");
    expect(nextMonday("2026-11-04")).toBe("2026-11-09");
    expect(nextMonday("2026-11-09")).toBe("2026-11-16");
  });
});

describe("query", () => {
  it("parses with safe defaults", () => {
    expect(parseCalendarQuery({}, "2026-11-04")).toEqual({
      view: "list",
      range: "month",
      date: "2026-11-04",
    });
    expect(
      parseCalendarQuery({ view: "calendar", range: "week", date: "2026-02-30" }, "2026-11-04"),
    ).toEqual({ view: "calendar", range: "week", date: "2026-11-04" });
    expect(parseCalendarQuery({ date: ["2026-12-01", "x"] }, "2026-11-04").date).toBe("2026-12-01");
  });

  it("builds short links", () => {
    expect(calendarHref({ range: "month", date: "2026-11-04" }, "2026-11-04")).toBe(
      "/tasks?view=calendar",
    );
    expect(calendarHref({ range: "week", date: "2026-11-10" })).toBe(
      "/tasks?view=calendar&range=week&date=2026-11-10",
    );
  });
});

describe("order in a day (3.2)", () => {
  it("project, seminar, open task, Google by time, paper, done task", () => {
    const list = [
      item("done", "2026-11-04", { done: true }),
      item("paper", "2026-11-04", { source: "paper" }),
      item("g2", "2026-11-04T15:00:00+09:00", { source: "google", allDay: false }),
      item("g1", "2026-11-04T09:00:00+09:00", { source: "google", allDay: false }),
      item("gAll", "2026-11-04", { source: "google" }),
      item("open", "2026-11-04"),
      item("sem", "2026-11-04", { source: "seminar" }),
      item("proj", "2026-11-04", { source: "project" }),
    ].sort(compareItems);
    expect(list.map((i) => i.id)).toEqual([
      "proj",
      "sem",
      "open",
      "gAll",
      "g1",
      "g2",
      "paper",
      "done",
    ]);
  });

  it("only open tasks move", () => {
    expect(isMovable(item("a", "2026-11-04", { taskId: "1" }))).toBe(true);
    expect(isMovable(item("a", "2026-11-04", { taskId: "1", done: true }))).toBe(false);
    expect(isMovable(item("p", "2026-11-04", { source: "project" }))).toBe(false);
  });
});

describe("period line (3.3)", () => {
  it("takes items covering the whole span; partial ones stay bars", () => {
    const { line, rest } = splitPeriodLine(
      [
        item("goal", "2026-10-01", { source: "goal", end: "2026-12-31" }),
        item("week", "2026-11-02", { source: "review", end: "2026-11-08" }),
        item("t", "2026-11-04"),
      ],
      visibleSpan("month", "2026-11-04"),
    );
    expect(line.map((i) => i.id)).toEqual(["goal"]);
    expect(rest.map((i) => i.id)).toEqual(["week", "t"]);
    // In the week view the weekly review covers everything too.
    expect(splitPeriodLine(rest, visibleSpan("week", "2026-11-04")).line.map((i) => i.id)).toEqual([
      "week",
    ]);
  });
});

describe("layoutWeek", () => {
  const days = gridWeeks("week", "2026-11-04")[0]!;

  it("packs bars into at most two lanes and clips them to the week", () => {
    const l = layoutWeek(
      [
        item("goal", "2026-10-01", { source: "goal", end: "2026-12-31" }),
        item("rev", "2026-11-02", { source: "review", end: "2026-11-04" }),
        item("rev2", "2026-11-05", { source: "review", end: "2026-11-09" }),
        item("third", "2026-11-03", { source: "review", end: "2026-11-04" }),
        item("t", "2026-11-04"),
        item("out", "2026-11-20"),
      ],
      days,
      null,
    );
    expect(l.lanes).toBe(2);
    expect(l.bars.find((b) => b.item.id === "goal")).toMatchObject({
      col: 0,
      span: 7,
      continuesBefore: true,
      continuesAfter: true,
    });
    const rev = l.bars.find((b) => b.item.id === "rev")!;
    const rev2 = l.bars.find((b) => b.item.id === "rev2")!;
    expect(rev.lane).toBe(rev2.lane); // a free lane is reused
    expect(rev2).toMatchObject({ col: 3, span: 4, continuesAfter: true });
    expect(l.bars.some((b) => b.item.id === "third")).toBe(false); // no third lane
    expect(l.cells[2]!.shown.map((i) => i.id)).toEqual(["t"]);
    expect(l.cells[2]!.all.map((i) => i.id).sort()).toEqual(["goal", "rev", "t", "third"]);
  });

  it("keeps three lines per month cell: 2 + '+n' when more", () => {
    const three = [item("a", "2026-11-04"), item("b", "2026-11-04"), item("c", "2026-11-04")];
    expect(layoutWeek(three, days, 3).cells[2]).toMatchObject({ hidden: 0 });
    const four = [...three, item("d", "2026-11-04")];
    const cell = layoutWeek(four, days, 3).cells[2]!;
    expect(cell.shown.map((i) => i.id)).toEqual(["a", "b"]);
    expect(cell.hidden).toBe(2);
  });

  it("bars use up the line budget and unplaced bars count in '+n'", () => {
    const bars = [
      item("r1", "2026-11-02", { source: "review", end: "2026-11-08" }),
      item("r2", "2026-11-02", { source: "review", end: "2026-11-08" }),
      item("r3", "2026-11-04", { source: "review", end: "2026-11-05" }),
    ];
    const l = layoutWeek([...bars, item("a", "2026-11-04")], days, 3);
    expect(l.lanes).toBe(2);
    // 1 slot left; "a" + r3 overflow → "+2"
    expect(l.cells[2]).toMatchObject({ shown: [], hidden: 2 });
    // Monday: only the lanes, nothing else
    expect(l.cells[0]).toMatchObject({ shown: [], hidden: 0 });
  });
});

describe("helpers", () => {
  it("lists a day's items including bars", () => {
    const list = [
      item("r", "2026-11-01", { end: "2026-11-03", source: "review" }),
      item("t", "2026-11-03"),
    ];
    expect(itemsOn(list, "2026-11-03").map((i) => i.id)).toEqual(["t", "r"]);
    expect(itemsOn(list, "2026-11-04")).toEqual([]);
  });

  it("dots: three sources at most, tasks hollow only when all done", () => {
    const dots = dayDots([
      item("d", "2026-11-04", { done: true }),
      item("p", "2026-11-04", { source: "project" }),
      item("s", "2026-11-04", { source: "seminar" }),
      item("g", "2026-11-04", { source: "google" }),
    ]);
    expect(dots).toEqual([
      { source: "project", hollow: false },
      { source: "seminar", hollow: false },
      { source: "google", hollow: false },
    ]);
    expect(dayDots([item("d", "x", { done: true })])).toEqual([{ source: "task", hollow: true }]);
    expect(dayDots([item("d", "x", { done: true }), item("o", "x")])).toEqual([
      { source: "task", hollow: false },
    ]);
  });

  it("moves an item to another day", () => {
    const moved = moveItemTo([item("a", "2026-11-04"), item("b", "2026-11-05")], "a", "2026-11-09");
    expect(moved[0]!.start).toBe("2026-11-09");
    expect(moved[1]!.start).toBe("2026-11-05");
  });

  it("grid keys (5.2)", () => {
    expect(navDay("month", "2026-11-04", "ArrowLeft")).toBe("2026-11-03");
    expect(navDay("month", "2026-11-04", "ArrowDown")).toBe("2026-11-11");
    expect(navDay("week", "2026-11-04", "ArrowUp")).toBe("2026-11-04");
    expect(navDay("month", "2026-11-04", "Home")).toBe("2026-11-02");
    expect(navDay("month", "2026-11-04", "End")).toBe("2026-11-08");
    expect(navDay("month", "2026-01-31", "PageDown")).toBe("2026-02-28");
    expect(navDay("week", "2026-11-04", "PageUp")).toBe("2026-10-28");
    expect(navDay("month", "2026-11-04", "x")).toBeNull();
  });
});

describe("sources (표시)", () => {
  it("defaults: papers off, others on", () => {
    expect(SOURCES.filter((s) => !DEFAULT_SOURCES[s])).toEqual(["paper"]);
  });

  it("parses stored choices defensively", () => {
    expect(parseSources(null)).toBe(DEFAULT_SOURCES);
    expect(parseSources("{bad")).toBe(DEFAULT_SOURCES);
    expect(parseSources('{"paper":true,"task":"x"}')).toMatchObject({ paper: true, task: true });
  });

  it("filters items; Google only when set up", () => {
    const list = [
      item("t", "2026-11-04"),
      item("p", "2026-11-04", { source: "paper" }),
      item("g", "2026-11-04", { source: "google" }),
    ];
    expect(visibleItems(list, DEFAULT_SOURCES, "ok").map((i) => i.id)).toEqual(["t", "g"]);
    expect(visibleItems(list, DEFAULT_SOURCES, "off").map((i) => i.id)).toEqual(["t"]);
    const none = Object.fromEntries(
      SOURCES.map((s) => [s, s === "google"]),
    ) as typeof DEFAULT_SOURCES;
    expect(noneChosen(none, "off")).toBe(true);
    expect(noneChosen(none, "ok")).toBe(false);
  });
});
