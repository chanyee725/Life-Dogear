import { readFileSync } from "node:fs";
import ICAL from "ical.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedRangeCount, clearIcsCache, loadGoogleItems } from "@/lib/calendar/ics";
import { feedUrl, fetchIcs, MAX_ICS_BYTES } from "@/lib/calendar/ics/fetch";
import {
  expandIcs,
  fastForwardStart,
  MAX_ITEMS_PER_FEED,
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
  const { items, complete } = expandIcs(parseIcs(SAMPLE), NOV);
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

  it("keeps the series TZID for occurrences when the feed has no VTIMEZONE", () => {
    const feed = parseIcs(
      ics(`
BEGIN:VEVENT
UID:paris
DTSTART;TZID=Europe/Paris:20261005T090000
DTEND;TZID=Europe/Paris:20261005T100000
RRULE:FREQ=WEEKLY
EXDATE;TZID=Europe/Paris:20261109T090000
SUMMARY:파리 주간
END:VEVENT`),
    );
    // Paris is UTC+1 in November: 09:00 there is 17:00 in Seoul. 11-09 is excluded.
    expect(expandIcs(feed, NOV).items.map((i) => i.start)).toEqual([
      "2026-11-02T17:00:00+09:00",
      "2026-11-16T17:00:00+09:00",
      "2026-11-23T17:00:00+09:00",
      "2026-11-30T17:00:00+09:00",
    ]);
  });

  it("expands the sample completely", () => {
    expect(complete).toBe(true);
  });

  const event = (uid: string, rule: string, dtstart = "TZID=Asia/Seoul:20000103T090000") => `
BEGIN:VEVENT
UID:${uid}
DTSTART;${dtstart}
DTEND;${dtstart.replace(/T(\d\d)/, (_, h: string) => `T${String(Number(h) + 1).padStart(2, "0")}`)}
RRULE:${rule}
SUMMARY:${uid}
END:VEVENT`;

  it("reaches the range for old daily events, quickly", () => {
    const feed = parseIcs(ics(event("daily", "FREQ=DAILY", "TZID=Asia/Seoul:20100101T090000")));
    const result = expandIcs(feed, NOV);
    expect(result.complete).toBe(true);
    expect(result.items).toHaveLength(30);
    expect(result.items[0]!.start).toBe("2026-11-01T09:00:00+09:00");
  });

  it("stays bounded with many hourly events since 2000 and reports it", () => {
    const body = Array.from({ length: 300 }, (_, i) => event(`h${i}`, "FREQ=HOURLY")).join("\n");
    const feed = parseIcs(ics(body));
    const t0 = performance.now();
    const result = expandIcs(feed, NOV);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(result.complete).toBe(false);
    expect(result.items.length).toBeLessThanOrEqual(MAX_ITEMS_PER_FEED);
    expect(result.items.every((i) => i.start >= "2026-11-01")).toBe(true);
  });

  it("marks COUNT rules that cannot reach the range as incomplete", () => {
    const feed = parseIcs(ics(event("c", "FREQ=DAILY;COUNT=100000")));
    expect(expandIcs(feed, NOV)).toEqual({ items: [], complete: false });
  });

  it("spends at most one iteration budget per feed", () => {
    // COUNT rules cannot be fast-forwarded; 300 of them would cost 300 × the per-event cap.
    const body = Array.from({ length: 300 }, (_, i) =>
      event(`c${i}`, "FREQ=MINUTELY;COUNT=1000000"),
    ).join("\n");
    const feed = parseIcs(ics(body));
    const t0 = performance.now();
    const result = expandIcs(feed, NOV);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(result).toEqual({ items: [], complete: false });
  });

  it("caps items per feed", () => {
    const feed = parseIcs(ics(event("d", "FREQ=MINUTELY", "TZID=Asia/Seoul:20261101T000000")));
    const result = expandIcs(feed, NOV);
    expect(result.items).toHaveLength(MAX_ITEMS_PER_FEED);
    expect(result.complete).toBe(false);
  });

  it("fast-forwards to the same occurrences as iterating from DTSTART", () => {
    const rules = [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH",
      "FREQ=DAILY;INTERVAL=3",
      "FREQ=DAILY;BYDAY=MO,WE",
      "FREQ=HOURLY;INTERVAL=5;BYHOUR=10,15",
      "FREQ=WEEKLY;UNTIL=20261115T000000Z",
    ];
    for (const rule of rules) {
      const comp = parseIcs(ics(event("f", rule, "TZID=Asia/Seoul:20200106T100000"))).events[0]!;
      const ev = new ICAL.Event(comp);
      const moved = fastForwardStart(ev, "2026-10-29");
      expect(moved, rule).toBeDefined();
      expect(moved!.toString() < "2026-10-29", rule).toBe(true);
      const list = (it: ICAL.RecurExpansion) => {
        const out: string[] = [];
        for (let n = it.next(); n && n.toString() <= "2026-11-30T23"; n = it.next()) {
          if (n.toString() >= "2026-11-01") out.push(n.toString());
        }
        return out;
      };
      expect(list(ev.iterator(moved)), rule).toEqual(list(ev.iterator()));
    }
    // COUNT and MONTHLY rules iterate from DTSTART.
    const counted = new ICAL.Event(parseIcs(ics(event("c", "FREQ=DAILY;COUNT=9000"))).events[0]!);
    expect(fastForwardStart(counted, "2026-10-29")).toBeUndefined();
    const monthly = new ICAL.Event(parseIcs(ics(event("m", "FREQ=MONTHLY"))).events[0]!);
    expect(fastForwardStart(monthly, "2026-10-29")).toBeUndefined();
    expect(expandIcs(parseIcs(ics(event("m", "FREQ=MONTHLY"))), NOV)).toMatchObject({
      complete: true,
      items: [{ start: "2026-11-03T09:00:00+09:00" }],
    });
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

describe("fetchIcs redirects", () => {
  it("refuses a redirect to plain http", async () => {
    const downgrade: typeof fetch = async () => {
      const res = new Response(SAMPLE);
      Object.defineProperty(res, "url", { value: "http://calendar.example/x.ics" });
      return res;
    };
    await expect(fetchIcs(new URL(FEED_A), { fetchImpl: downgrade })).rejects.toMatchObject({
      code: "insecure_redirect",
    });
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

  it("reuses the expansion of a range and says when a feed was cut short", async () => {
    const fetchImpl = vi.fn(ok);
    await loadGoogleItems(NOV, { env: env(FEED_A), fetchImpl });
    await loadGoogleItems(NOV, { env: env(FEED_A), fetchImpl });
    expect(cachedRangeCount()).toBe(1);
    await loadGoogleItems(
      { from: "2026-11-02", to: "2026-11-08" },
      { env: env(FEED_A), fetchImpl },
    );
    expect(cachedRangeCount()).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const dense = ics(`
BEGIN:VEVENT
UID:d
DTSTART:20261101T000000Z
RRULE:FREQ=MINUTELY
SUMMARY:d
END:VEVENT`);
    const result = await loadGoogleItems(NOV, {
      env: env(FEED_B),
      fetchImpl: async () => new Response(dense),
    });
    expect(result.status).toBe("partial");
    expect(JSON.stringify(warn.mock.calls)).toContain("#1 truncated");
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
