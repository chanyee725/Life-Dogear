import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/calendar/route";
import { useFreshDb } from "./repo-helpers";

vi.mock("@/lib/calendar/ics", () => ({
  loadGoogleItems: vi.fn(async () => ({
    items: [
      {
        id: "google:e1:2026-11-05",
        source: "google",
        title: "구글 일정",
        start: "2026-11-05",
        allDay: true,
        href: "https://calendar.google.com/calendar/r/day/2026/11/5",
      },
    ],
    status: "ok",
  })),
}));

const SAME = {
  host: "localhost:3000",
  origin: "http://localhost:3000",
  "sec-fetch-site": "same-origin",
};
const CROSS = {
  host: "localhost:3000",
  origin: "http://evil.example",
  "sec-fetch-site": "cross-site",
};
const get = (query: string, headers: Record<string, string> = SAME) =>
  GET(new NextRequest(`http://localhost:3000/api/calendar${query}`, { headers }));

beforeEach(async () => {
  await useFreshDb();
});

describe("GET /api/calendar", () => {
  it("returns the range's items, not cached", async () => {
    const res = await get("?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      items: [expect.objectContaining({ id: "google:e1:2026-11-05", source: "google" })],
      google: "ok",
      googleWrite: false,
    });
  });

  it("rejects bad ranges with 400 and cross-site requests with 403", async () => {
    expect((await get("?from=2026-11-01")).status).toBe(400);
    expect((await get("?from=2026-01-01&to=2026-12-31")).status).toBe(400);
    expect((await get("?from=2026-11-01&to=2026-11-30", CROSS)).status).toBe(403);
  });
});
