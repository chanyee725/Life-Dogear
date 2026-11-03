import type { Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/graph/cosmos/route";
import { getCosmos } from "@/lib/cosmos/load";
import type { CosmosResponse } from "@/lib/cosmos/types";
import { areas, links, papers, projects, thoughts } from "@/lib/repo";
import { setStarred } from "@/lib/repo/stars";
import { useFreshDb } from "./repo-helpers";

const HOST = { host: "localhost:3000" };
const CROSS_SITE = { ...HOST, origin: "http://evil.example", "sec-fetch-site": "cross-site" };
const get = (headers: Record<string, string> = HOST, query = "") =>
  GET(new NextRequest(`http://localhost:3000/api/graph/cosmos${query}`, { headers }));

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

describe("GET /api/graph/cosmos", () => {
  it("is same-origin only and no-store", async () => {
    expect((await get(CROSS_SITE)).status).toBe(403);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as CosmosResponse;
    expect(body).toMatchObject({ nodes: [], edges: [], top: [], lonely: [], neglected: [] });
  });

  it("scores nodes, assigns galaxies and fills the panel lists", async () => {
    const area = await areas.create({ title: "연구 분야" });
    const project = await projects.create({ title: "프로젝트", areaId: area.id });
    const core = await papers.create({ title: "핵심 논문", importance: "core" });
    const light = await papers.create({ title: "가벼운 논문", importance: "light" });
    const alone = await thoughts.create({ title: "외톨이" });
    await links.link({ type: "paper", id: core.id }, { type: "project", id: project.id });
    await links.link({ type: "paper", id: light.id }, { type: "project", id: project.id });

    const body = (await (await get()).json()) as CosmosResponse;
    const info = (id: string) => body.cosmos[id as keyof typeof body.cosmos]!;
    expect(info(`paper:${core.id}`).score).toBeGreaterThan(info(`paper:${light.id}`).score);
    expect(info(`paper:${core.id}`).galaxy).toBe(area.id);
    expect(info(`thought:${alone.id}`).galaxy).toBeNull();
    expect(body.galaxies).toEqual([{ id: area.id, title: "연구 분야" }]);
    expect(body.top).toHaveLength(5);
    expect(body.lonely).toEqual([`thought:${alone.id}`]);
  });

  it("raises a starred item to at least the star floor", async () => {
    const t = await thoughts.create({ title: "생각" });
    const before = (await getCosmos()).cosmos[`thought:${t.id}`]!;
    await setStarred({ type: "thought", id: t.id }, true);
    const after = (await getCosmos()).cosmos[`thought:${t.id}`]!;
    expect(before.starred).toBe(false);
    expect(after.starred).toBe(true);
    expect(after.score).toBeGreaterThanOrEqual(0.6);
  });

  it("passes graph filters through", async () => {
    await papers.create({ title: "논문" });
    await thoughts.create({ title: "생각" });
    const body = (await (await get(HOST, "?types=paper")).json()) as CosmosResponse;
    expect(body.nodes.map((n) => n.type)).toEqual(["paper"]);
  });

  it("uses a fixed number of queries regardless of graph size", async () => {
    const client = (db as unknown as { $client: Client }).$client;
    const execute = vi.spyOn(client, "execute");
    const count = async () => {
      execute.mockClear();
      await getCosmos();
      return execute.mock.calls.length;
    };
    const small = await count();
    for (let i = 0; i < 25; i++) {
      const p = await papers.create({ title: `논문 ${i}` });
      const t = await thoughts.create({ title: `생각 ${i}` });
      await links.link({ type: "paper", id: p.id }, { type: "thought", id: t.id });
      if (i % 5 === 0) await setStarred({ type: "paper", id: p.id }, true);
    }
    expect(await count()).toBe(small);
  });
});
