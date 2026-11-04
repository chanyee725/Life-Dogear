import { describe, expect, it } from "vitest";
import { mergeAdded, sameEventKey } from "@/lib/calendar/dedupe";
import { toCalendarItem } from "@/lib/calendar/google-write";
import { expandIcs, parseIcs } from "@/lib/calendar/ics/parse";
import type { CalendarItem } from "@/lib/calendar/types";

const google = (uid: string, start: string, allDay = false): CalendarItem => ({
  id: `google:${uid}:${start}`,
  source: "google",
  title: "회의",
  start,
  allDay,
});

describe("mergeAdded", () => {
  // Written in Seoul time by the writer; the ICS feed of a calendar set to New York writes
  // the same instant in its own zone.
  const added = google("abc@google.com", "2026-11-05T14:00:00+09:00");
  const fromFeed = google("abc@google.com", "2026-11-05T00:00:00-05:00");

  it("treats the same uid and instant in another zone as one event", () => {
    expect(sameEventKey(added)).toBe(sameEventKey(fromFeed));
    const list = [fromFeed];
    expect(mergeAdded(list, [added])).toBe(list);
  });

  it("keeps a different instant or uid", () => {
    const later = google("abc@google.com", "2026-11-05T15:00:00+09:00");
    const other = google("xyz@google.com", "2026-11-05T14:00:00+09:00");
    expect(mergeAdded([fromFeed], [later, other])).toEqual([fromFeed, later, other]);
  });

  it("matches all-day items by uid and day", () => {
    const day = google("d@google.com", "2026-11-05", true);
    expect(mergeAdded([day], [{ ...day, title: "다른 제목" }])).toEqual([day]);
    expect(mergeAdded([day], [google("d@google.com", "2026-11-06", true)])).toHaveLength(2);
  });

  it("uses ids for app items, and drops repeats within `added`", () => {
    const task: CalendarItem = {
      id: "task:1",
      source: "task",
      title: "t",
      start: "2026-11-05",
      allDay: true,
    };
    expect(mergeAdded([task], [task, added, added])).toEqual([task, added]);
    expect(mergeAdded([task], [])).toEqual([task]);
  });
});

describe("mergeAdded on real reader and writer output", () => {
  it("merges a New York feed item with the item the writer returned", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "X-WR-TIMEZONE:America/New_York",
      "BEGIN:VEVENT",
      "UID:again0001@google.com",
      "SUMMARY:회의",
      "DTSTART:20261105T050000Z",
      "DTEND:20261105T060000Z",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const [fromFeed] = expandIcs(parseIcs(ics), { from: "2026-11-01", to: "2026-11-30" }).items;
    const added = toCalendarItem(
      {
        id: "again0001",
        iCalUID: "again0001@google.com",
        summary: "회의",
        start: { dateTime: "2026-11-05T14:00:00+09:00" },
        end: { dateTime: "2026-11-05T15:00:00+09:00" },
      },
      { title: "회의", date: "2026-11-05", start: "14:00" },
      "again0001",
    );
    // Different ids (the feed writes New York time), one event.
    expect(fromFeed.start).toBe("2026-11-05T00:00:00-05:00");
    expect(added.start).toBe("2026-11-05T14:00:00+09:00");
    expect(fromFeed.id).not.toBe(added.id);
    const list = [fromFeed];
    expect(mergeAdded(list, [added])).toBe(list);
  });
});
