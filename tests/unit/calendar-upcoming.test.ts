import { describe, expect, it } from "vitest";
import {
  UPCOMING_MAX,
  groupHeading,
  originLabel,
  relativeDay,
  upcoming,
} from "@/components/calendar/upcoming";
import type { CalendarItem } from "@/lib/calendar/types";

const item = (id: string, start: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id,
  source: "seminar",
  title: id,
  start,
  allDay: !start.includes("T"),
  ...extra,
});

const TODAY = "2026-11-04";
const NOW = "2026-11-04T05:00:00.000Z"; // 14:00 in Seoul

describe("upcoming (다음 일정)", () => {
  it("lists what is left from the day on, by day, timed first by time", () => {
    const list = upcoming(
      [
        item("later", "2026-11-06", { source: "seminar" }),
        item("task", TODAY, { source: "task" }), // not a calendar item
        item("g15", "2026-11-04T15:00:00+09:00", { source: "google" }),
        item("g9", "2026-11-04T09:00:00+09:00", { source: "google" }), // over
        item("g13", "2026-11-04T13:00:00+09:00", {
          source: "google",
          end: "2026-11-04T15:00:00+09:00", // still going
        }),
        item("proj", TODAY),
        item("before", "2026-11-03"),
      ],
      TODAY,
      TODAY,
      NOW,
    );
    expect(list.groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      [TODAY, ["g13", "g15", "proj"]],
      ["2026-11-06", ["later"]],
    ]);
    expect(list).toMatchObject({ shown: 4, more: 0 });
  });

  it("keeps a done item on the shown day only, struck through by the row", () => {
    const items = [
      item("doneToday", TODAY, { done: true }),
      item("doneLater", "2026-11-10", { done: true }),
    ];
    expect(
      upcoming(items, TODAY, TODAY, NOW).groups.flatMap((g) => g.items.map((i) => i.id)),
    ).toEqual(["doneToday"]);
  });

  it("leaves out tasks, done items of later days, periods, papers and goals", () => {
    const list = upcoming(
      [
        item("done", "2026-11-10", { done: true }),
        item("task", "2026-11-05", { source: "task" }),
        item("rev", "2026-11-02", { source: "review", end: "2026-11-08" }),
        item("rev1", "2026-11-05", { source: "review", end: "2026-11-05" }),
        item("goal", "2026-10-01", { source: "goal", end: "2026-12-31" }),
        item("paper", TODAY, { source: "paper" }),
      ],
      TODAY,
      TODAY,
      NOW,
    );
    expect(list.shown).toBe(0);
  });

  it("starts at midnight on another day and caps at ten", () => {
    const many = Array.from({ length: 13 }, (_, i) =>
      item(`t${String(i).padStart(2, "0")}`, "2026-11-10"),
    );
    const early = item("early", "2026-11-10T08:00:00+09:00", { source: "google" });
    const list = upcoming([...many, early], "2026-11-10", TODAY, NOW);
    expect(list.shown).toBe(UPCOMING_MAX);
    expect(list.more).toBe(4);
    expect(list.groups[0]!.items[0]!.id).toBe("early");
  });

  it("uses Seoul days for timed events", () => {
    // 23:30 UTC on 11/4 is 08:30 on 11/5 in Seoul.
    const list = upcoming(
      [item("g", "2026-11-04T23:30:00.000Z", { source: "google" })],
      TODAY,
      TODAY,
      NOW,
    );
    expect(list.groups[0]!.day).toBe("2026-11-05");
  });
});

describe("headings and origin", () => {
  it("says 오늘, 내일, else the date with the weekday", () => {
    expect(groupHeading(TODAY, TODAY)).toBe("오늘");
    expect(groupHeading("2026-11-05", TODAY)).toBe("내일");
    expect(groupHeading("2026-11-06", TODAY)).toBe("11월 6일(금)");
    expect(relativeDay("2026-11-03", TODAY)).toBeNull();
  });

  it("names the task's parent or the source", () => {
    expect(originLabel(item("a", TODAY, { source: "task", parent: "학위 논문" }))).toBe(
      "학위 논문",
    );
    expect(originLabel(item("a", TODAY, { source: "task" }))).toBe("");
    expect(originLabel(item("s", TODAY, { source: "seminar" }))).toBe("활동");
    expect(originLabel(item("g", TODAY, { source: "google" }))).toBe("Google");
  });
});
