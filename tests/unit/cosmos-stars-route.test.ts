import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/graph/stars/route";
import { papers } from "@/lib/repo";
import { isStarred } from "@/lib/repo/stars";
import { useFreshDb } from "./repo-helpers";

const HOST = { host: "localhost:3000", "content-type": "application/json" };
const CROSS_SITE = { ...HOST, origin: "http://evil.example", "sec-fetch-site": "cross-site" };
const put = (body: unknown, headers: Record<string, string> = HOST) =>
  PUT(
    new NextRequest("http://localhost:3000/api/graph/stars", {
      method: "PUT",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(async () => {
  await useFreshDb();
});

describe("PUT /api/graph/stars", () => {
  it("stars and unstars an item", async () => {
    const p = await papers.create({ title: "논문" });
    const ref = { type: "paper" as const, id: p.id };
    expect((await put({ node: `paper:${p.id}`, starred: true })).status).toBe(204);
    expect(await isStarred(ref)).toBe(true);
    expect((await put({ node: `paper:${p.id}`, starred: false })).status).toBe(204);
    expect(await isStarred(ref)).toBe(false);
  });

  it("rejects cross-site requests, bad bodies, topics and missing items", async () => {
    const p = await papers.create({ title: "논문" });
    expect((await put({ node: `paper:${p.id}`, starred: true }, CROSS_SITE)).status).toBe(403);
    expect((await put("not json")).status).toBe(400);
    expect((await put({ node: `paper:${p.id}`, starred: "yes" })).status).toBe(400);
    expect((await put({ node: "paper:../x", starred: true })).status).toBe(400);
    expect((await put({ node: "tag:seed-tag", starred: true })).status).toBe(400);
    expect((await put({ node: "paper:seed-missing", starred: true })).status).toBe(404);
    expect((await put("x".repeat(2000))).status).toBe(413);
  });
});
