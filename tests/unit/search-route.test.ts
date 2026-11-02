import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/search/route";
import { thoughts } from "@/lib/repo";
import type { SearchHit } from "@/lib/search";
import { useFreshDb } from "./repo-helpers";

const HOST = { host: "localhost:3000" };
const SAME_ORIGIN = { ...HOST, "sec-fetch-site": "same-origin" };
const CROSS_SITE = { ...HOST, origin: "http://evil.example", "sec-fetch-site": "cross-site" };

const call = (query: string, headers: Record<string, string> = SAME_ORIGIN) =>
  GET(new NextRequest(`http://localhost:3000/api/search?${query}`, { headers }));

beforeEach(async () => {
  await useFreshDb();
});

describe("GET /api/search", () => {
  it("returns hits for the query, uncached", async () => {
    const t = await thoughts.create({ title: "검색될 생각" });
    await thoughts.create({ title: "다른 것" });
    const res = await call(`q=${encodeURIComponent("검색")}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { hits } = (await res.json()) as { hits: SearchHit[] };
    expect(hits.map((h) => h.id)).toEqual([t.id]);
  });

  it("applies the limit and returns nothing for an empty query", async () => {
    for (let i = 0; i < 4; i++) await thoughts.create({ title: `항목 ${i}` });
    expect(
      ((await (await call("q=항목&limit=2")).json()) as { hits: unknown[] }).hits,
    ).toHaveLength(2);
    expect(await (await call("q=")).json()).toEqual({ hits: [] });
    expect(
      ((await (await call("q=항목&limit=abc")).json()) as { hits: unknown[] }).hits,
    ).toHaveLength(4);
  });

  it("rejects cross-site requests", async () => {
    const res = await call("q=x", CROSS_SITE);
    expect(res.status).toBe(403);
  });
});
