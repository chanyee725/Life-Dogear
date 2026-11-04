import type { Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as graphRoute from "@/app/api/graph/route";
import * as layoutRoute from "@/app/api/graph/layout/route";
import * as localRoute from "@/app/api/graph/local/route";
import {
  areas as areasTable,
  goals,
  graphLayout,
  links as linksTable,
  projects as projectsTable,
} from "@/db/schema";
import { loadGraphSource } from "@/lib/graph/load";
import { parseGraphFilter, parseLayoutBody, parseLocalQuery } from "@/lib/graph/query";
import type { GraphResponse } from "@/lib/graph/types";
import { areas, links, notes, papers, projects, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

const HOST = { host: "localhost:3000" };
const SAME_ORIGIN = { ...HOST, origin: "http://localhost:3000", "sec-fetch-site": "same-origin" };
const CROSS_SITE = { ...HOST, origin: "http://evil.example", "sec-fetch-site": "cross-site" };
const T = "2026-11-03T00:00:00.000Z";
const LIFE = "seed-goal-life";
const YEAR = "seed-goal-year";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

const get = (path: string) =>
  new NextRequest(`http://localhost:3000/api/graph${path}`, { headers: HOST });

async function seedGoals() {
  await db.insert(goals).values([
    { id: LIFE, title: "좋은 연구자", horizon: "life", createdAt: T, updatedAt: T },
    {
      id: YEAR,
      title: "1저자 논문",
      horizon: "year",
      period: "2027",
      parentId: LIFE,
      createdAt: T,
      updatedAt: T,
    },
  ]);
}

describe("graph query parsing", () => {
  it("parses filters and ignores unknown or malformed values", () => {
    expect(
      parseGraphFilter(
        new URLSearchParams("types=goal,paper,nope&area=bad id&tag= NLP &archived=1&orphans=0"),
      ),
    ).toEqual({ types: ["goal", "paper"], tag: "NLP", archived: true });
    expect(parseGraphFilter(new URLSearchParams(""))).toEqual({});
    expect(parseGraphFilter(new URLSearchParams(`area=${YEAR}&orphans=true`))).toEqual({
      area: YEAR,
      orphans: true,
    });
  });

  it("parses local queries", () => {
    expect(parseLocalQuery(new URLSearchParams(`node=goal:${LIFE}&depth=2`))).toEqual({
      node: `goal:${LIFE}`,
      depth: 2,
    });
    expect(parseLocalQuery(new URLSearchParams(`node=goal:${LIFE}&depth=9`))?.depth).toBe(1);
    expect(parseLocalQuery(new URLSearchParams("node=bogus:x"))).toBeNull();
    expect(parseLocalQuery(new URLSearchParams("node=paper:../../etc"))).toBeNull();
  });

  it("validates layout bodies", () => {
    const node = `paper:${LIFE}`;
    expect(
      parseLayoutBody({
        positions: [
          { node, x: 1, y: 2 },
          { node, x: 3, y: 4 },
        ],
      }),
    ).toEqual([{ node, x: 3, y: 4 }]);
    expect(parseLayoutBody({ positions: [{ node, x: Number.NaN, y: 0 }] })).toBeNull();
    expect(parseLayoutBody({ positions: [{ node: "paper:", x: 0, y: 0 }] })).toBeNull();
    expect(parseLayoutBody({ positions: "x" })).toBeNull();
    expect(parseLayoutBody(null)).toBeNull();
  });
});

describe("GET /api/graph", () => {
  it("returns notes with their area membership", async () => {
    const area = await areas.create({ title: "공부" });
    const note = await notes.create({ title: "노트", areaId: area.id });
    const body = (await (await graphRoute.GET(get(""))).json()) as GraphResponse;
    expect(body.nodes.find((n) => n.id === `note:${note.id}`)).toMatchObject({
      type: "note",
      title: "노트",
      areaId: area.id,
      size: 1,
    });
    expect(body.edges).toContainEqual({
      source: `note:${note.id}`,
      target: `area:${area.id}`,
      kind: "belongs",
    });
  });

  it("returns goals, membership and links with sizes", async () => {
    await seedGoals();
    const project = await projects.create({ title: "연구 X" });
    await db.update(projectsTable).set({ goalId: YEAR });
    const paper = await papers.create({ title: "논문 A" });
    await links.link({ type: "project", id: project.id }, { type: "paper", id: paper.id });

    const res = await graphRoute.GET(get(""));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as GraphResponse;
    expect(body.nodes.find((n) => n.id === `goal:${YEAR}`)).toMatchObject({
      type: "goal",
      horizon: "year",
      period: "2027",
      size: 2,
    });
    expect(body.edges).toEqual(
      expect.arrayContaining([
        { source: `goal:${YEAR}`, target: `goal:${LIFE}`, kind: "belongs" },
        { source: `project:${project.id}`, target: `goal:${YEAR}`, kind: "belongs" },
        { source: `project:${project.id}`, target: `paper:${paper.id}`, kind: "link" },
      ]),
    );
    expect(body.positions).toEqual([]);
  });

  it("lists every area id in sidebar order (the area color order)", async () => {
    await db.insert(areasTable).values([
      { id: "a-late", title: "늦게", sortOrder: 2, createdAt: T, updatedAt: T },
      { id: "a-first", title: "먼저", sortOrder: 0, createdAt: T, updatedAt: T },
      { id: "a-mid", title: "중간", sortOrder: 1, archivedAt: T, createdAt: T, updatedAt: T },
    ]);
    // Filtered to papers only: no area nodes, but the order is still complete.
    const res = await graphRoute.GET(get("?types=paper"));
    const body = (await res.json()) as GraphResponse;
    expect(body.areaOrder).toEqual(["a-first", "a-mid", "a-late"]);
  });

  it("marks body links and applies filters", async () => {
    const a = await thoughts.create({ title: "생각 A" });
    const b = await papers.create({ title: "논문 B" });
    await thoughts.create({ title: "외톨이" });
    await links.link({ type: "thought", id: a.id }, { type: "paper", id: b.id });
    await db.update(linksTable).set({ via: "body" });

    let body = (await (await graphRoute.GET(get(""))).json()) as GraphResponse;
    expect(body.edges).toEqual([
      { source: `thought:${a.id}`, target: `paper:${b.id}`, kind: "body" },
    ]);
    body = (await (await graphRoute.GET(get("?orphans=1"))).json()) as GraphResponse;
    expect(body.nodes.map((n) => n.title)).toEqual(["외톨이"]);
  });

  it("uses a fixed number of queries regardless of graph size", async () => {
    // drizzle keeps the libSQL client on `$client` (not in the `Db` type).
    const client = (db as unknown as { $client: Client }).$client;
    const execute = vi.spyOn(client, "execute");
    const count = async () => {
      execute.mockClear();
      await loadGraphSource({ tags: true });
      return execute.mock.calls.length;
    };
    const small = await count();
    expect(small).toBeGreaterThanOrEqual(10);

    for (let i = 0; i < 30; i++) {
      const p = await papers.create({ title: `논문 ${i}`, tags: [`t${i % 3}`] });
      const t = await thoughts.create({ title: `생각 ${i}` });
      await links.link({ type: "paper", id: p.id }, { type: "thought", id: t.id });
    }
    expect(await count()).toBe(small);
    execute.mockRestore();
  });
});

describe("graph reads are same-origin only", () => {
  it("rejects cross-site GETs with 403", async () => {
    await seedGoals();
    const cross = (path: string) =>
      new NextRequest(`http://localhost:3000/api/graph${path}`, { headers: CROSS_SITE });
    expect((await graphRoute.GET(cross(""))).status).toBe(403);
    expect((await localRoute.GET(cross(`/local?node=goal:${LIFE}`))).status).toBe(403);
    const same = new NextRequest("http://localhost:3000/api/graph", { headers: SAME_ORIGIN });
    expect((await graphRoute.GET(same)).status).toBe(200);
  });
});

describe("GET /api/graph/local", () => {
  it("returns the neighbourhood, 400 for bad ids and 404 for missing nodes", async () => {
    await seedGoals();
    let res = await localRoute.GET(get(`/local?node=goal:${YEAR}&depth=1`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphResponse;
    expect(body.nodes.map((n) => n.id).sort()).toEqual([`goal:${LIFE}`, `goal:${YEAR}`]);

    res = await localRoute.GET(get(`/local?node=tag:${LIFE}`));
    expect(res.status).toBe(400);
    res = await localRoute.GET(get("/local?node=goal:nope"));
    expect(res.status).toBe(400);
    res = await localRoute.GET(get("/local?node=paper:seed-missing"));
    expect(res.status).toBe(404);
  });
});

describe("/api/graph/layout", () => {
  const put = (body: unknown, headers: Record<string, string> = SAME_ORIGIN) =>
    layoutRoute.PUT(
      new NextRequest("http://localhost:3000/api/graph/layout", {
        method: "PUT",
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { ...headers, "content-type": "application/json" },
      }),
    );
  const del = (headers: Record<string, string> = SAME_ORIGIN) =>
    layoutRoute.DELETE(
      new NextRequest("http://localhost:3000/api/graph/layout", { method: "DELETE", headers }),
    );

  it("saves, updates, returns only existing nodes' positions, and clears", async () => {
    await seedGoals();
    expect((await put({ positions: [{ node: `goal:${LIFE}`, x: 1, y: 2 }] })).status).toBe(204);
    expect(
      (
        await put({
          positions: [
            { node: `goal:${LIFE}`, x: 10, y: 20 },
            // Positions of items that do not exist are dropped on save.
            { node: "paper:seed-deleted", x: 5, y: 5 },
          ],
        })
      ).status,
    ).toBe(204);
    expect(await db.select().from(graphLayout)).toHaveLength(1);
    // A stale row (item deleted after saving) is never returned.
    await db
      .insert(graphLayout)
      .values({ nodeType: "paper", nodeId: "seed-deleted", x: 0, y: 0, updatedAt: T });

    const body = (await (await graphRoute.GET(get(""))).json()) as GraphResponse;
    expect(body.positions).toEqual([{ node: `goal:${LIFE}`, x: 10, y: 20 }]);

    expect((await del()).status).toBe(204);
    expect(await db.select().from(graphLayout)).toHaveLength(0);
  });

  it("rejects cross-site requests and malformed bodies", async () => {
    const ok = { positions: [{ node: `goal:${LIFE}`, x: 1, y: 2 }] };
    expect((await put(ok, CROSS_SITE)).status).toBe(403);
    expect((await del(CROSS_SITE)).status).toBe(403);
    expect((await put("{not json")).status).toBe(400);
    expect((await put({ positions: [{ node: "x", x: 1, y: 2 }] })).status).toBe(400);
    // Byte limit, not string length: 2-byte characters push it over.
    const big = JSON.stringify({ positions: [], pad: "가".repeat(700_000) });
    expect(big.length).toBeLessThan(2_000_000);
    expect((await put(big)).status).toBe(413);
    expect(await db.select().from(graphLayout)).toHaveLength(0);
  });
});
