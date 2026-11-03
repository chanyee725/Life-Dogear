import { describe, expect, it } from "vitest";
import { goalOptionsFor, parentOptionsFor } from "@/app/goals/options";
import { goalLevelLabel, joinPeriod, splitPeriod } from "@/app/goals/period";

const g = (id: string, horizon: "life" | "year" | "quarter", archivedAt: string | null = null) => ({
  id,
  title: id,
  horizon,
  period: horizon === "life" ? null : horizon === "year" ? "2027" : "2027-Q1",
  archivedAt,
});

describe("goal form helpers", () => {
  it("offers life/year parents, never itself, archived only when current", () => {
    const all = [g("L", "life"), g("Y", "year"), g("Q", "quarter"), g("old", "life", "x")];
    expect(parentOptionsFor(all, "Y", null).map((o) => o.value)).toEqual(["L"]);
    expect(parentOptionsFor(all, "Q", "old")).toEqual([
      { value: "L", label: "L", horizon: "life", period: null },
      { value: "Y", label: "2027 · Y", horizon: "year", period: "2027" },
      { value: "old", label: "old (보관됨)", horizon: "life", period: null },
    ]);
    expect(goalOptionsFor(all, null).map((o) => o.value)).toEqual(["L", "Y", "Q"]);
  });

  it("splits and joins periods", () => {
    expect(splitPeriod("2027-Q3")).toEqual({ year: "2027", quarter: "Q3" });
    expect(splitPeriod("2028")).toEqual({ year: "2028", quarter: "Q1" });
    expect(splitPeriod(null, new Date(2026, 5, 1))).toEqual({ year: "2026", quarter: "Q1" });
    expect(joinPeriod("life", "2027", "Q2")).toBe("");
    expect(joinPeriod("year", "2027", "Q2")).toBe("2027");
    expect(joinPeriod("quarter", "2027", "Q2")).toBe("2027-Q2");
    expect(goalLevelLabel({ horizon: "quarter", period: "2027-Q2" })).toBe("2027-Q2 분기 목표");
    expect(goalLevelLabel({ horizon: "life", period: null })).toBe("인생 목표");
  });
});
