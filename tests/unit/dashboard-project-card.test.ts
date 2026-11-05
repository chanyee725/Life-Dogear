import { describe, expect, it } from "vitest";
import { daysBetween, dueChip, progressPercent } from "@/components/dashboard/project-card";

describe("home project card helpers", () => {
  const today = "2026-11-05";

  it("counts calendar days across months", () => {
    expect(daysBetween(today, "2026-11-29")).toBe(24);
    expect(daysBetween(today, "2026-12-01")).toBe(26);
    expect(daysBetween(today, "2026-11-02")).toBe(-3);
  });

  it("formats the due chip as D-n with tone by urgency", () => {
    expect(dueChip(null, today)).toBeNull();
    expect(dueChip("2026-11-29", today)).toEqual({
      text: "D-24",
      label: "마감 2026년 11월 29일",
      tone: "gray",
    });
    expect(dueChip("2026-11-08", today)).toMatchObject({ text: "D-3", tone: "orange" });
    expect(dueChip("2026-11-09", today)).toMatchObject({ text: "D-4", tone: "gray" });
    expect(dueChip(today, today)).toEqual({ text: "D-day", label: "마감 오늘", tone: "orange" });
    expect(dueChip("2026-11-02", today)).toEqual({
      text: "D+3",
      label: "마감 지남, 2026년 11월 2일",
      tone: "red",
    });
  });

  it("computes progress percent", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(3, 3)).toBe(100);
    expect(progressPercent(5, 3)).toBe(100);
  });
});
