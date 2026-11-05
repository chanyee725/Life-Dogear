import { describe, expect, it } from "vitest";
import { dateToIso, isoToDate, parseDateInput } from "@/components/fields/date-input";

describe("parseDateInput", () => {
  it("reads YYYY.MM.DD and the other separators as ISO", () => {
    expect(parseDateInput("2026.11.04")).toBe("2026-11-04");
    expect(parseDateInput("2026-11-04")).toBe("2026-11-04");
    expect(parseDateInput("2026/11/04")).toBe("2026-11-04");
    expect(parseDateInput("20261104")).toBe("2026-11-04");
    expect(parseDateInput(" 2026.11.04. ")).toBe("2026-11-04");
  });

  it("gives '' for blank (cleared)", () => {
    expect(parseDateInput("")).toBe("");
    expect(parseDateInput("   ")).toBe("");
  });

  it("waits for two-digit month and day while typing", () => {
    expect(parseDateInput("2026.11.1")).toBeNull();
    expect(parseDateInput("2026.11.")).toBeNull();
    expect(parseDateInput("2026.1.5", true)).toBe("2026-01-05");
  });

  it("rejects dates that do not exist", () => {
    expect(parseDateInput("2026.02.30")).toBeNull();
    expect(parseDateInput("2026.13.01")).toBeNull();
    expect(parseDateInput("2026.11.00")).toBeNull();
    expect(parseDateInput("2028.02.29")).toBe("2028-02-29");
    expect(parseDateInput("abc")).toBeNull();
  });
});

describe("isoToDate / dateToIso", () => {
  it("round-trips without a timezone shift", () => {
    const date = isoToDate("2026-11-04")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 4]);
    expect(dateToIso(date)).toBe("2026-11-04");
    expect(isoToDate("")).toBeUndefined();
    expect(isoToDate(null)).toBeUndefined();
  });
});
