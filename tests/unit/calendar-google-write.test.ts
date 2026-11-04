import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/calendar/events/route";
import {
  clearGoogleTokenCache,
  eventBody,
  googleWriteEnabled,
  insertEvent,
  parseNewEvent,
  TOKEN_URL,
} from "@/lib/calendar/google-write";

// Placeholders only; never real credentials.
const ENV = {
  GOOGLE_OAUTH_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret-xxxx",
  GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token-xxxx",
  GOOGLE_CALENDAR_ID: "",
};
const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenOk = (token = "access-1", expires_in = 3600) =>
  json(200, { access_token: token, expires_in, token_type: "Bearer" });
const created = (over: Record<string, unknown> = {}) =>
  json(200, {
    id: "abc123",
    iCalUID: "abc123@google.com",
    htmlLink: "https://www.google.com/calendar/event?eid=xyz",
    summary: "회의",
    start: { dateTime: "2026-11-05T14:00:00+09:00" },
    end: { dateTime: "2026-11-05T15:00:00+09:00" },
    ...over,
  });

/** fetch mock answering by URL from queued responses. */
function mockFetch(routes: { token?: (Response | Error)[]; events?: (Response | Error)[] }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    const queue = u === TOKEN_URL ? routes.token : routes.events;
    const next = queue?.shift();
    if (!next) throw new Error(`unexpected fetch ${u}`);
    if (next instanceof Error) throw next;
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

beforeEach(() => clearGoogleTokenCache());

describe("googleWriteEnabled", () => {
  it("needs all three OAuth keys; the calendar id is optional", () => {
    expect(googleWriteEnabled(ENV)).toBe(true);
    expect(googleWriteEnabled({ ...ENV, GOOGLE_OAUTH_REFRESH_TOKEN: " " })).toBe(false);
    expect(googleWriteEnabled({})).toBe(false);
  });
});

describe("parseNewEvent", () => {
  it("accepts all-day and timed input, trims the title, drops blank times", () => {
    expect(parseNewEvent({ title: "  a  b ", date: "2026-11-05", start: "", end: null })).toEqual({
      title: "a b",
      date: "2026-11-05",
    });
    expect(parseNewEvent({ title: "x", date: "2026-11-05", start: "09:30", end: "10:00" })).toEqual(
      { title: "x", date: "2026-11-05", start: "09:30", end: "10:00" },
    );
    expect(parseNewEvent({ title: "x", date: "2026-11-05", clientId: "abc0v" })).toMatchObject({
      clientId: "abc0v",
    });
  });

  it("rejects bad input", () => {
    for (const bad of [
      null,
      "x",
      { title: "", date: "2026-11-05" },
      { title: "x".repeat(201), date: "2026-11-05" },
      { title: "x", date: "2026-02-30" },
      { title: "x", date: "2026-11-05", start: "24:00" },
      { title: "x", date: "2026-11-05", end: "10:00" },
      { title: "x", date: "2026-11-05", start: "10:00", end: "10:00" },
      { title: "x", date: "2026-11-05", start: 9 },
      { title: "x", date: "2026-11-05", clientId: "ABCDE" },
      { title: "x", date: "2026-11-05", clientId: "abcw1" },
      { title: "x", date: "2026-11-05", clientId: "abc" },
    ]) {
      expect(parseNewEvent(bad)).toBeNull();
    }
  });
});

describe("eventBody", () => {
  it("all day: date with an exclusive next-day end", () => {
    expect(eventBody({ title: "휴가", date: "2026-12-31" })).toEqual({
      summary: "휴가",
      start: { date: "2026-12-31" },
      end: { date: "2027-01-01" },
    });
  });

  it("timed: Seoul dateTime, one hour when no end", () => {
    expect(eventBody({ title: "회의", date: "2026-11-05", start: "23:30" })).toEqual({
      summary: "회의",
      start: { dateTime: "2026-11-05T23:30:00+09:00", timeZone: "Asia/Seoul" },
      end: { dateTime: "2026-11-06T00:30:00+09:00", timeZone: "Asia/Seoul" },
    });
    expect(
      eventBody({ title: "회의", date: "2026-11-05", start: "09:00", end: "10:15" }).end,
    ).toEqual({ dateTime: "2026-11-05T10:15:00+09:00", timeZone: "Asia/Seoul" });
  });
});

describe("insertEvent", () => {
  it("exchanges the refresh token, posts the event and returns a google item", async () => {
    const { impl, calls } = mockFetch({ token: [tokenOk()], events: [created()] });
    const item = await insertEvent(
      { title: "회의", date: "2026-11-05", start: "14:00" },
      { env: ENV, fetchImpl: impl },
    );
    expect(item).toEqual({
      id: "google:abc123@google.com:2026-11-05T14:00:00+09:00",
      source: "google",
      title: "회의",
      start: "2026-11-05T14:00:00+09:00",
      end: "2026-11-05T15:00:00+09:00",
      allDay: false,
      href: "https://www.google.com/calendar/event?eid=xyz",
    });
    const [token, post] = calls;
    expect(token.init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(token.init.body)))).toEqual({
      client_id: ENV.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: ENV.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: ENV.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });
    expect(post.url).toBe(EVENTS);
    expect((post.init.headers as Record<string, string>).authorization).toBe("Bearer access-1");
    expect(JSON.parse(String(post.init.body)).start).toEqual({
      dateTime: "2026-11-05T14:00:00+09:00",
      timeZone: "Asia/Seoul",
    });
  });

  it("returns an all-day item with an inclusive end", async () => {
    const { impl } = mockFetch({
      token: [tokenOk()],
      events: [
        created({ summary: "휴가", start: { date: "2026-11-05" }, end: { date: "2026-11-06" } }),
      ],
    });
    const item = await insertEvent(
      { title: "휴가", date: "2026-11-05" },
      { env: ENV, fetchImpl: impl },
    );
    expect(item).toEqual({
      id: "google:abc123@google.com:2026-11-05",
      source: "google",
      title: "휴가",
      start: "2026-11-05",
      allDay: true,
      href: "https://www.google.com/calendar/event?eid=xyz",
    });
  });

  it("caches the access token until it nears expiry", async () => {
    let t = 1_000_000;
    const now = () => t;
    const { impl, calls } = mockFetch({
      token: [tokenOk("access-1", 3600), tokenOk("access-2", 3600)],
      events: [created(), created(), created()],
    });
    const ev = { title: "회의", date: "2026-11-05", start: "14:00" };
    await insertEvent(ev, { env: ENV, fetchImpl: impl, now });
    t += 30 * 60_000;
    await insertEvent(ev, { env: ENV, fetchImpl: impl, now });
    expect(calls.filter((c) => c.url === TOKEN_URL)).toHaveLength(1);
    t += 30 * 60_000; // past expiry minus the margin
    await insertEvent(ev, { env: ENV, fetchImpl: impl, now });
    const auths = calls
      .filter((c) => c.url === EVENTS)
      .map((c) => (c.init.headers as Record<string, string>).authorization);
    expect(auths).toEqual(["Bearer access-1", "Bearer access-1", "Bearer access-2"]);
  });

  it("sends an event id; a client id is reused as is", async () => {
    const { impl, calls } = mockFetch({ token: [tokenOk()], events: [created(), created()] });
    await insertEvent({ title: "x", date: "2026-11-05" }, { env: ENV, fetchImpl: impl });
    expect(JSON.parse(String(calls[1].init.body)).id).toMatch(/^[a-v0-9]{32}$/);
    await insertEvent(
      { title: "x", date: "2026-11-05", clientId: "again0001" },
      { env: ENV, fetchImpl: impl },
    );
    expect(JSON.parse(String(calls[2].init.body)).id).toBe("again0001");
  });

  it("409 (an earlier try went through) returns the existing event", async () => {
    const { impl, calls } = mockFetch({
      token: [tokenOk()],
      events: [json(409, { error: { code: 409 } }), created({ id: "again0001" })],
    });
    const item = await insertEvent(
      { title: "회의", date: "2026-11-05", start: "14:00", clientId: "again0001" },
      { env: ENV, fetchImpl: impl },
    );
    expect(item.id).toBe("google:abc123@google.com:2026-11-05T14:00:00+09:00");
    expect(calls[2].init.method).toBe("GET");
    expect(calls[2].url).toBe(`${EVENTS}/again0001`);
  });

  it("409 on a deleted event is invalid", async () => {
    const { impl } = mockFetch({
      token: [tokenOk()],
      events: [json(409, {}), created({ status: "cancelled" })],
    });
    expect(
      await insertEvent(
        { title: "x", date: "2026-11-05", clientId: "again0001" },
        { env: ENV, fetchImpl: impl },
      ).catch((e: { code: string }) => e.code),
    ).toBe("invalid");
  });

  it("uses a custom calendar id, URL-encoded", async () => {
    const { impl, calls } = mockFetch({ token: [tokenOk()], events: [created()] });
    await insertEvent(
      { title: "x", date: "2026-11-05" },
      { env: { ...ENV, GOOGLE_CALENDAR_ID: "team@group.calendar.google.com" }, fetchImpl: impl },
    );
    expect(calls[1].url).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/team%40group.calendar.google.com/events",
    );
  });

  const code = (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: { code?: string }) => e.code,
    );
  const ev = { title: "x", date: "2026-11-05" };

  it("not_configured without keys, before any fetch", async () => {
    const { impl, calls } = mockFetch({});
    expect(await code(insertEvent(ev, { env: {}, fetchImpl: impl }))).toBe("not_configured");
    expect(calls).toHaveLength(0);
  });

  it("auth when the refresh token is rejected", async () => {
    const { impl } = mockFetch({ token: [json(400, { error: "invalid_grant" })] });
    expect(await code(insertEvent(ev, { env: ENV, fetchImpl: impl }))).toBe("auth");
  });

  it("401 retries once with a fresh token, then auth", async () => {
    const { impl, calls } = mockFetch({
      token: [tokenOk("a1"), tokenOk("a2")],
      events: [json(401, {}), json(401, {})],
    });
    expect(await code(insertEvent(ev, { env: ENV, fetchImpl: impl }))).toBe("auth");
    expect(calls.filter((c) => c.url === TOKEN_URL)).toHaveLength(2);
  });

  it("401 then success after the retry", async () => {
    const { impl } = mockFetch({
      token: [tokenOk("a1"), tokenOk("a2")],
      events: [json(401, {}), created()],
    });
    expect(await code(insertEvent(ev, { env: ENV, fetchImpl: impl }))).toBe("ok");
  });

  it("network on fetch failure or 5xx; invalid on 400; secrets never in the error", async () => {
    const down = mockFetch({ token: [new TypeError("fetch failed")] });
    const err: unknown = await insertEvent(ev, { env: ENV, fetchImpl: down.impl }).catch(
      (e: unknown) => e,
    );
    expect((err as { code: string }).code).toBe("network");
    expect((err as Error).message).not.toContain("xxxx");

    const busy = mockFetch({ token: [tokenOk()], events: [json(503, {})] });
    expect(await code(insertEvent(ev, { env: ENV, fetchImpl: busy.impl }))).toBe("network");

    const bad = mockFetch({ token: [tokenOk()], events: [json(400, {})] });
    expect(await code(insertEvent(ev, { env: ENV, fetchImpl: bad.impl }))).toBe("invalid");
  });

  it("invalid input before any fetch", async () => {
    const { impl, calls } = mockFetch({});
    expect(await code(insertEvent({ title: "", date: "x" }, { env: ENV, fetchImpl: impl }))).toBe(
      "invalid",
    );
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/calendar/events", () => {
  const SAME = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  };
  const post = (body: unknown, headers: Record<string, string> = SAME) =>
    POST(
      new NextRequest("http://localhost:3000/api/calendar/events", {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const stubKeys = () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  };

  it("201 with the item", async () => {
    stubKeys();
    vi.stubGlobal("fetch", mockFetch({ token: [tokenOk()], events: [created()] }).impl);
    const res = await post({ title: "회의", date: "2026-11-05", start: "14:00" });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).item).toMatchObject({ source: "google", title: "회의" });
  });

  it("400 invalid for bad JSON or fields, 403 cross-site", async () => {
    stubKeys();
    expect(await (await post("{")).json()).toEqual({ error: "invalid" });
    expect((await post({ title: "x", date: "nope" })).status).toBe(400);
    const cross = { ...SAME, origin: "http://evil.example", "sec-fetch-site": "cross-site" };
    expect((await post({ title: "x", date: "2026-11-05" }, cross)).status).toBe(403);
  });

  it("503 not_configured, 502 auth / network", async () => {
    for (const k of Object.keys(ENV)) vi.stubEnv(k, "");
    const off = await post({ title: "x", date: "2026-11-05" });
    expect(off.status).toBe(503);
    expect(await off.json()).toEqual({ error: "not_configured" });

    stubKeys();
    vi.stubGlobal("fetch", mockFetch({ token: [json(401, {})] }).impl);
    const auth = await post({ title: "x", date: "2026-11-05" });
    expect([auth.status, await auth.json()]).toEqual([502, { error: "auth" }]);

    clearGoogleTokenCache();
    vi.stubGlobal("fetch", mockFetch({ token: [new TypeError("down")] }).impl);
    const net = await post({ title: "x", date: "2026-11-05" });
    expect([net.status, await net.json()]).toEqual([502, { error: "network" }]);
  });
});
