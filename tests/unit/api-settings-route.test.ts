import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/settings/route";
import { useFreshDb } from "./repo-helpers";

// Placeholder only; never a real calendar address.
const FEED = "https://calendar.example/ics/route-secret-token-rrrr/basic.ics";
const ORIGIN = "http://localhost:3000";
const SAME = { host: "localhost:3000", origin: ORIGIN, "sec-fetch-site": "same-origin" };

const put = (body: unknown, headers: Record<string, string> = SAME) =>
  PUT(
    new NextRequest(`${ORIGIN}/api/settings`, {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { ...headers, "content-type": "application/json" },
    }),
  );
const get = (headers: Record<string, string> = SAME) =>
  GET(new NextRequest(`${ORIGIN}/api/settings`, { headers }));

describe("/api/settings", () => {
  let logs: ReturnType<typeof vi.spyOn>[];
  beforeEach(async () => {
    await useFreshDb();
    logs = (["log", "warn", "error"] as const).map((m) => vi.spyOn(console, m));
  });
  afterEach(() => vi.restoreAllMocks());

  it("saves a value and answers with the masked view only", async () => {
    const res = await put({ key: "GOOGLE_CALENDAR_ICS_URLS", value: FEED });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(text).not.toContain("route-secret-token");
    expect(JSON.parse(text).view.calendarRead).toEqual({
      source: "app",
      masked: ["https://calendar.example/••••••"],
    });
    const again = await (await get()).text();
    expect(again).not.toContain("route-secret-token");
    expect(JSON.parse(again).view.calendarRead.source).toBe("app");
    const logged = logs.flatMap((l) => l.mock.calls.flat().map(String)).join(" ");
    expect(logged).not.toContain("route-secret-token");
  });

  it("clears with an empty value", async () => {
    await put({ key: "GOOGLE_CALENDAR_ICS_URLS", value: FEED });
    const res = await put({ key: "GOOGLE_CALENDAR_ICS_URLS", value: "" });
    expect((await res.json()).view.calendarRead.source).not.toBe("app");
  });

  it("refuses security keys, bad values and cross-site requests", async () => {
    const refused = await put({ key: "ALLOWED_EMAILS", value: "x@example.com" });
    expect(refused.status).toBe(400);
    expect(await refused.text()).not.toContain("x@example.com");
    const bad = await put({ key: "GOOGLE_CALENDAR_ICS_URLS", value: "http://plain-secret-zz" });
    expect(bad.status).toBe(400);
    expect(await bad.text()).not.toContain("plain-secret");
    expect((await put("{")).status).toBe(400);
    const cross = { ...SAME, origin: "https://evil.example", "sec-fetch-site": "cross-site" };
    expect((await put({ key: "GOOGLE_CALENDAR_ID", value: "x" }, cross)).status).toBe(403);
    expect((await get(cross)).status).toBe(403);
  });
});
