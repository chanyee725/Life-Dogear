import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearIcsCache, loadGoogleItems } from "@/lib/calendar/ics";
import { feedUrl, fetchIcs, MAX_ICS_BYTES } from "@/lib/calendar/ics/fetch";
import {
  expandIcs,
  MAX_ITEMS_PER_FEED,
  MAX_ITERATIONS_PER_EVENT,
  parseIcs,
} from "@/lib/calendar/ics/parse";
import { msToZonedIso, wallToMs } from "@/lib/calendar/ics/zone";

const SAMPLE = readFileSync(new URL("./fixtures/calendar/sample.ics", import.meta.url), "utf8");
const NOV = { from: "2026-11-01", to: "2026-11-30" };
// Placeholders only; never real calendar addresses.
const FEED_A = "https://calendar.example/ics/secret-token-aaaa/basic.ics";
const FEED_B = "https://calendar.example/ics/secret-token-bbbb/basic.ics";

const ics = (body: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body.trim().split("\n").join("\r\n")}\r\nEND:VCALENDAR\r\n`;

describe("expandIcs", () => {
  const items = expandIcs(parseIcs(SAMPLE), NOV);
  const byUid = (uid: string) => items.filter((i) => i.id.startsWith(`google:${uid}:`));

  it("reads all-day events with an inclusive end", () => {
    expect(byUid("allday-1@google.com")).toEqual([
      {
        id: "google:allday-1@google.com:2026-11-05",
        source: "google",
        title: "학회 마감",
        start: "2026-11-05",
        allDay: true,
        href: "https://calendar.google.com/calendar/r/day/2026/11/5",
      },
    ]);
    expect(byUid("allday-multi@google.com")[0]).toMatchObject({
      start: "2026-11-10",
      end: "2026-11-12",
      allDay: true,
    });
  });

  it("shows timed events in Seoul time, whatever zone they were written in", () => {
    expect(byUid("seoul-1@google.com")[0]).toMatchObject({
      start: "2026-11-03T14:00:00+09:00",
      end: "2026-11-03T15:30:00+09:00",
      allDay: false,
    });
    expect(byUid("utc-1@google.com")[0]!.start).toBe("2026-11-04T10:00:00+09:00");
    // 19:00 EST (UTC-5, after the Nov 1 change) is 09:00 next day in Seoul.
    expect(byUid("ny-1@google.com")[0]!.start).toBe("2026-11-10T09:00:00+09:00");
    // Floating times use the calendar's X-WR-TIMEZONE.
    expect(byUid("floating-1@google.com")[0]!.start).toBe("2026-11-06T09:00:00+09:00");
  });

  it("sends only title, time, all-day flag and link", () => {
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        expect.arrayContaining(["allDay", "href", "id", "source", "start", "title"]),
      );
      for (const key of Object.keys(item)) {
        expect(["id", "source", "title", "start", "end", "allDay", "href"]).toContain(key);
      }
    }
    expect(JSON.stringify(items)).not.toMatch(/비공개 메모|302호/);
  });

  it("expands weekly events with EXDATE, moved and cancelled occurrences", () => {
    expect(
      byUid("weekly@google.com")
        .map((i) => i.start)
        .sort(),
    ).toEqual([
      "2026-11-02T10:00:00+09:00",
      // 11-09 excluded (EXDATE); 11-16 moved to Tuesday; 11-23 cancelled.
      "2026-11-17T15:00:00+09:00",
      "2026-11-30T10:00:00+09:00",
    ]);
    expect(byUid("weekly@google.com").find((i) => i.start.startsWith("2026-11-17"))!.title).toBe(
      "랩 미팅 (화요일로)",
    );
  });

  it("expands endless rules only through the range", () => {
    const daily = byUid("daily-forever@google.com");
    expect(daily).toHaveLength(30);
    expect(daily[0]!.start).toBe("2026-11-01T08:00:00+09:00");
    expect(daily.at(-1)!.start).toBe("2026-11-30T08:00:00+09:00");
  });

  it("drops cancelled and out-of-range events", () => {
    expect(byUid("cancelled@google.com")).toEqual([]);
    expect(byUid("outside@google.com")).toEqual([]);
  });

  it("caps iterations per event and items per feed", () => {
    // Every minute since 2020: the iteration cap stops it long before the range.
    const minutely = parseIcs(
      ics(`
BEGIN:VEVENT
UID:m
DTSTART:20200101T000000Z
RRULE:FREQ=MINUTELY
SUMMARY:m
END:VEVENT`),
    );
    expect(expandIcs(minutely, NOV)).toEqual([]);
    expect(MAX_ITERATIONS_PER_EVENT).toBeLessThanOrEqual(10_000);

    // Every minute inside the range: the item cap applies.
    const dense = parseIcs(
      ics(`
BEGIN:VEVENT
UID:d
DTSTART:20261101T000000Z
RRULE:FREQ=MINUTELY
SUMMARY:d
END:VEVENT`),
    );
    expect(expandIcs(dense, NOV)).toHaveLength(MAX_ITEMS_PER_FEED);
  });

  it("rejects text that is not a calendar", () => {
    expect(() => parseIcs("<html>login</html>")).toThrow(
      expect.objectContaining({ name: "IcsParseError" }),
    );
  });
});

describe("zone helpers", () => {
  it("converts wall-clock times across DST", () => {
    const ms = wallToMs(
      { year: 2026, month: 3, day: 8, hour: 3, minute: 30, second: 0 },
      "America/New_York",
    );
    expect(new Date(ms).toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(msToZonedIso(Date.UTC(2026, 10, 3, 15), "Asia/Seoul")).toBe("2026-11-04T00:00:00+09:00");
  });
});

describe("fetchIcs", () => {
  it("accepts https (and webcal) only", () => {
    expect(feedUrl(FEED_A)?.protocol).toBe("https:");
    expect(feedUrl("webcal://calendar.example/x.ics")?.protocol).toBe("https:");
    expect(feedUrl("http://calendar.example/x.ics")).toBeNull();
    expect(feedUrl("file:///etc/passwd")).toBeNull();
    expect(feedUrl("not a url")).toBeNull();
  });

  it("gives up after the time limit", async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        ),
      );
    await expect(
      fetchIcs(new URL(FEED_A), { fetchImpl: hang, timeoutMs: 20 }),
    ).rejects.toMatchObject({
      name: "IcsFetchError",
      code: "timeout",
    });
  });

  it("stops reading past the size cap, declared or not", async () => {
    const big = "x".repeat(1024);
    const declared: typeof fetch = async () =>
      new Response(big, { headers: { "content-length": String(MAX_ICS_BYTES + 1) } });
    await expect(fetchIcs(new URL(FEED_A), { fetchImpl: declared })).rejects.toMatchObject({
      code: "too_large",
    });
    const streamed: typeof fetch = async () => new Response(big);
    await expect(
      fetchIcs(new URL(FEED_A), { fetchImpl: streamed, maxBytes: 100 }),
    ).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("reports HTTP errors by status only", async () => {
    const missing: typeof fetch = async () => new Response("nope", { status: 404 });
    const error = await fetchIcs(new URL(FEED_A), { fetchImpl: missing }).catch((e: Error) => e);
    expect(error).toMatchObject({ name: "IcsFetchError", code: "http_404" });
    expect(String((error as Error).message)).not.toContain("calendar.example");
  });
});

describe("loadGoogleItems", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    clearIcsCache();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  const env = (value: string) => ({ GOOGLE_CALENDAR_ICS_URLS: value });
  const ok: typeof fetch = async () => new Response(SAMPLE);

  it("is off without addresses", async () => {
    const fetchImpl = vi.fn(ok);
    expect(await loadGoogleItems(NOV, { env: env(" , "), fetchImpl })).toEqual({
      items: [],
      status: "off",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("merges feeds, dropping the same event seen twice", async () => {
    const result = await loadGoogleItems(NOV, { env: env(`${FEED_A}, ${FEED_B}`), fetchImpl: ok });
    expect(result.status).toBe("ok");
    const ids = result.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("google:allday-1@google.com:2026-11-05");
  });

  it("caches each address, failures briefly, and never exposes the address", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T00:00:00Z"));
    const fetchImpl = vi.fn(async (url: URL | RequestInfo) =>
      String(url).includes("aaaa") ? new Response(SAMPLE) : new Response("", { status: 500 }),
    ) as unknown as typeof fetch;
    const options = { env: env(`${FEED_A},${FEED_B},ftp://calendar.example/x`), fetchImpl };

    const first = await loadGoogleItems(NOV, options);
    expect(first.status).toBe("error");
    expect(first.items.length).toBeGreaterThan(0); // the working feed still shows
    expect(fetchImpl).toHaveBeenCalledTimes(2); // the ftp address is never fetched

    await loadGoogleItems(NOV, options);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // both cached

    vi.setSystemTime(new Date("2026-11-04T00:01:30Z"));
    await loadGoogleItems(NOV, options);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // failure expired after a minute

    vi.setSystemTime(new Date("2026-11-04T00:11:00Z"));
    await loadGoogleItems(NOV, options);
    expect(fetchImpl).toHaveBeenCalledTimes(5); // success expired after ten minutes

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("#2");
    expect(logged).toContain("#3");
    expect(logged).toContain("IcsFetchError(http_500)");
    expect(logged).not.toMatch(/calendar\.example|secret-token|ftp/);
    expect(JSON.stringify(first)).not.toMatch(/calendar\.example|secret-token/);
  });
});
