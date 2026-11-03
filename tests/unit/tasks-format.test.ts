import { describe, expect, it } from "vitest";
import { dayLabel, isoWeekRange } from "@/components/tasks/dates";
import { addDays, formatDue, localDate, parentHref } from "@/components/tasks/format";

describe("formatDue", () => {
  const today = "2026-11-03";
  it("words the near days and colours overdue and today", () => {
    expect(formatDue(null, today)).toBeNull();
    expect(formatDue("2026-11-01", today)).toMatchObject({
      text: "지남 · 2026.11.01",
      label: "마감 지남, 2026년 11월 1일",
      tone: "red",
    });
    expect(formatDue(today, today)).toMatchObject({ text: "오늘", tone: "amber" });
    expect(formatDue("2026-11-04", today)).toMatchObject({ text: "내일", tone: "muted" });
    expect(formatDue("2026-11-07", today)).toMatchObject({ text: "2026.11.07", tone: "muted" });
    expect(formatDue("2026-11-01", today, true)).toMatchObject({
      text: "2026.11.01",
      tone: "muted",
    });
    expect(formatDue(today, today)!.className).toContain("text-tone-amber-fg");
  });

  it("does calendar arithmetic across months", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(localDate(new Date(2026, 10, 3, 23, 59))).toBe("2026-11-03");
  });
});

describe("task dates", () => {
  it("finds the ISO week and labels days", () => {
    expect(isoWeekRange("2026-11-03")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(isoWeekRange("2026-11-08")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(isoWeekRange("2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(dayLabel("2026-11-03", "2026-11-03")).toBe("오늘");
    expect(dayLabel("2026-11-04", "2026-11-03")).toBe("내일");
    expect(dayLabel("2026-11-05", "2026-11-03")).toBe("11.05 목");
  });
});

describe("parentHref", () => {
  it("links to the parent's page, or nothing for inbox tasks", () => {
    expect(parentHref({ parentType: "goal", parentId: "g1" })).toBe("/goals/g1");
    expect(parentHref({ parentType: "area", parentId: "a1" })).toBe("/areas/a1");
    expect(parentHref({ parentType: null, parentId: null })).toBeNull();
  });
});
