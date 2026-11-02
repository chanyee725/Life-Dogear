import { describe, expect, it } from "vitest";
import {
  goalPeriodsFor,
  isValidPeriod,
  isoWeek,
  periodLabel,
  periodOf,
  periodRange,
  reviewTitle,
  shiftPeriod,
  weeklyReviewDue,
} from "@/lib/reviews/period";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

describe("review periods", () => {
  it("computes ISO weeks, including year boundaries", () => {
    expect(isoWeek(d("2026-11-03"))).toEqual({ year: 2026, week: 45 });
    expect(isoWeek(d("2026-01-01"))).toEqual({ year: 2026, week: 1 }); // Thursday
    expect(isoWeek(d("2027-01-01"))).toEqual({ year: 2026, week: 53 }); // Friday
    expect(isoWeek(d("2024-12-30"))).toEqual({ year: 2025, week: 1 }); // Monday
    expect(isoWeek(d("2026-11-08"))).toEqual({ year: 2026, week: 45 }); // Sunday
  });

  it("formats the period of a date for every kind", () => {
    const date = d("2026-11-03");
    expect(periodOf("week", date)).toBe("2026-W45");
    expect(periodOf("month", date)).toBe("2026-11");
    expect(periodOf("quarter", date)).toBe("2026-Q4");
    expect(periodOf("year", date)).toBe("2026");
  });

  it("validates periods", () => {
    expect(isValidPeriod("week", "2026-W53")).toBe(true);
    expect(isValidPeriod("week", "2027-W53")).toBe(false);
    expect(isValidPeriod("week", "2026-W00")).toBe(false);
    expect(isValidPeriod("month", "2026-13")).toBe(false);
    expect(isValidPeriod("quarter", "2026-Q5")).toBe(false);
    expect(isValidPeriod("year", "2026")).toBe(true);
    expect(isValidPeriod("year", "2026-")).toBe(false);
    expect(isValidPeriod("month", 202611)).toBe(false);
  });

  it("computes ranges and shifts", () => {
    const w = periodRange("week", "2026-W45");
    expect([ymd(w.start), ymd(w.end)]).toEqual(["2026-11-02", "2026-11-08"]);
    const q = periodRange("quarter", "2026-Q4");
    expect([ymd(q.start), ymd(q.end)]).toEqual(["2026-10-01", "2026-12-31"]);
    expect(ymd(periodRange("month", "2028-02").end)).toBe("2028-02-29");

    expect(shiftPeriod("week", "2026-W01", -1)).toBe("2025-W52");
    expect(shiftPeriod("week", "2026-W53", 1)).toBe("2027-W01");
    expect(shiftPeriod("month", "2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("quarter", "2026-Q4", 1)).toBe("2027-Q1");
    expect(shiftPeriod("year", "2026", 1)).toBe("2027");
  });

  it("titles and labels", () => {
    expect(reviewTitle("week", "2026-W45")).toBe("2026-W45 주간 회고");
    expect(reviewTitle("year", "2026")).toBe("2026 연간 회고");
    expect(periodLabel("week", "2026-W45")).toBe("2026년 45주차 (11/2–11/8)");
    expect(periodLabel("month", "2026-11")).toBe("2026년 11월");
    expect(periodLabel("quarter", "2026-Q4")).toBe("2026년 4분기");
    expect(periodLabel("year", "bad")).toBe("bad");
  });

  it("maps a period to the goal quarter(s) and year", () => {
    expect(goalPeriodsFor("week", "2026-W45")).toEqual({ quarters: ["2026-Q4"], year: "2026" });
    // 2026-W53 runs Dec 28 – Jan 3; its Thursday is Dec 31.
    expect(goalPeriodsFor("week", "2026-W53")).toEqual({ quarters: ["2026-Q4"], year: "2026" });
    expect(goalPeriodsFor("month", "2026-02")).toEqual({ quarters: ["2026-Q1"], year: "2026" });
    expect(goalPeriodsFor("quarter", "2026-Q3")).toEqual({ quarters: ["2026-Q3"], year: "2026" });
    expect(goalPeriodsFor("year", "2026").quarters).toHaveLength(4);
  });

  it("nudges for the weekly review on Sunday and Monday only", () => {
    expect(weeklyReviewDue(d("2026-11-08"))).toBe("2026-W45"); // Sunday
    expect(weeklyReviewDue(d("2026-11-09"))).toBe("2026-W45"); // Monday → last week
    expect(weeklyReviewDue(d("2026-11-03"))).toBeNull(); // Tuesday
    expect(weeklyReviewDue(d("2026-11-07"))).toBeNull(); // Saturday
  });
});
