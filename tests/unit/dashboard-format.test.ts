import { describe, expect, it } from "vitest";
import {
  formatAuthors,
  formatDate,
  formatRelative,
  paperByline,
} from "@/components/dashboard/format";

describe("dashboard format helpers", () => {
  it("formats dates", () => {
    expect(formatDate("2026-11-02")).toBe("2026.11.02");
    expect(formatDate(null)).toBe("");
    expect(formatDate("garbage")).toBe("");
  });

  it("formats relative times", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(formatRelative("2026-11-02T11:59:30Z", now)).toBe("방금 전");
    expect(formatRelative("2026-11-02T11:15:00Z", now)).toBe("45분 전");
    expect(formatRelative("2026-11-02T09:00:00Z", now)).toBe("3시간 전");
    expect(formatRelative("2026-10-31T12:00:00Z", now)).toBe("2일 전");
    expect(formatRelative("2026-10-27T12:00:00Z", now)).toBe("6일 전");
    expect(formatRelative("2026-10-26T12:00:00Z", now)).toBe("2026.10.26");
    expect(formatRelative("2026-10-01T12:00:00Z", now)).toBe("2026.10.01");
    expect(formatRelative(undefined, now)).toBe("");
  });

  it("formats authors and bylines", () => {
    expect(formatAuthors([])).toBe("");
    expect(formatAuthors(["Kim, J."])).toBe("Kim, J.");
    expect(formatAuthors(["Kim", "Lee", "Park"])).toBe("Kim 외 2명");
    expect(paperByline({ authors: ["Kim"], year: 2024, venue: "" })).toBe("Kim · 2024");
    expect(paperByline({ authors: [], year: null, venue: "ACL" })).toBe("ACL");
  });
});
