import { describe, expect, it } from "vitest";
import { seoulDate } from "@/components/calendar/model";
import { formatDate } from "@/components/ui";

// What ItemNotes shows for a note's last edit; tests run in UTC like Vercel.
describe("note date (ItemNotes)", () => {
  it("is the Seoul day as YYYY.MM.DD, even when UTC is still on the day before", () => {
    expect(formatDate(seoulDate("2026-11-04T16:30:00.000Z"))).toBe("2026.11.05");
    expect(formatDate(seoulDate("2026-11-04T14:59:00.000Z"))).toBe("2026.11.04");
  });
});
