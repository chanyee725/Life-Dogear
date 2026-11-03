import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "@/db/client";
import * as schema from "@/db/schema";
import { archive, areas, goals, links, papers, projects, seminars, thoughts } from "@/lib/repo";

let queries = 0;
beforeEach(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), {
    schema,
    logger: { logQuery: () => void queries++ },
  });
  await migrate(db, { migrationsFolder: "drizzle" });
  setDb(db);
});

async function counted<T>(fn: () => Promise<T>): Promise<[T, number]> {
  queries = 0;
  const out = await fn();
  return [out, queries];
}

describe("area goals", () => {
  it("keeps the area's goals in tree order, moving them up past other areas", async () => {
    const a = await areas.create({ title: "연구" });
    const b = await areas.create({ title: "건강" });
    const life = await goals.create({ title: "인생", horizon: "life", areaId: b.id });
    const year = await goals.create({
      title: "연",
      horizon: "year",
      period: "2027",
      parentId: life.id,
      areaId: a.id,
    });
    const q = await goals.create({
      title: "분기",
      horizon: "quarter",
      period: "2027-Q1",
      parentId: year.id,
      areaId: a.id,
      progressMode: "manual",
      manualProgress: 30,
    });
    const hidden = await goals.create({ title: "보관", horizon: "life", areaId: a.id });
    await archive.archive({ type: "goal", id: hidden.id });

    const tree = await goals.listTreeForArea(a.id);
    expect(tree.map((n) => n.goal.id)).toEqual([year.id]);
    expect(tree[0].children.map((n) => [n.goal.id, n.progress])).toEqual([[q.id, 30]]);
    expect(tree[0].progress).toBe(30);
    expect((await goals.listTreeForArea(b.id)).map((n) => n.children.length)).toEqual([0]);
  });
});

describe("areas.listMaterials", () => {
  it("collects direct and project/goal links, deduped, archived left out", async () => {
    const area = await areas.create({ title: "연구" });
    const A = { type: "area" as const, id: area.id };
    const p = await projects.create({ title: "프로젝트 X", areaId: area.id });
    const g = await goals.create({ title: "목표 Y", horizon: "life", areaId: area.id });
    const paper = await papers.create({ title: "논문" });
    const seminar = await seminars.create({ title: "세미나" });
    const thought = await thoughts.create({ title: "생각" });
    const old = await papers.create({ title: "보관 논문" });
    const otherProject = await projects.create({ title: "다른 영역" });
    const unrelated = await papers.create({ title: "무관" });
    const P = { type: "project" as const, id: p.id };
    const G = { type: "goal" as const, id: g.id };

    await links.link(A, { type: "paper", id: paper.id });
    await links.link({ type: "paper", id: paper.id }, P); // reverse direction, same paper
    await links.link(G, { type: "seminar", id: seminar.id });
    await links.link({ type: "thought", id: thought.id }, P);
    await links.link(P, { type: "paper", id: old.id });
    await archive.archive({ type: "paper", id: old.id });
    await links.link({ type: "project", id: otherProject.id }, { type: "paper", id: unrelated.id });
    await links.link(P, G); // not material

    expect(await areas.listMaterials(area.id)).toEqual([
      {
        ref: { type: "paper", id: paper.id },
        title: "논문",
        via: [{ type: "area" }, { type: "project", id: p.id, title: "프로젝트 X" }],
      },
      {
        ref: { type: "seminar", id: seminar.id },
        title: "세미나",
        via: [{ type: "goal", id: g.id, title: "목표 Y" }],
      },
      {
        ref: { type: "thought", id: thought.id },
        title: "생각",
        via: [{ type: "project", id: p.id, title: "프로젝트 X" }],
      },
    ]);

    // Archived projects are no path.
    await archive.archive(P);
    expect((await areas.listMaterials(area.id)).map((m) => m.title)).toEqual(["논문", "세미나"]);
  });

  it("runs a fixed number of queries however many projects and links", async () => {
    const small = await areas.create({ title: "작음" });
    await projects.create({ title: "p", areaId: small.id });
    const big = await areas.create({ title: "큼" });
    for (let i = 0; i < 6; i++) {
      const p = await projects.create({ title: `p${i}`, areaId: big.id });
      const paper = await papers.create({ title: `논문 ${i}` });
      const t = await thoughts.create({ title: `생각 ${i}` });
      await links.link({ type: "project", id: p.id }, { type: "paper", id: paper.id });
      await links.link({ type: "thought", id: t.id }, { type: "project", id: p.id });
      await goals.create({ title: `g${i}`, horizon: "life", areaId: big.id });
    }
    const [, smallMaterials] = await counted(() => areas.listMaterials(small.id));
    const [found, bigMaterials] = await counted(() => areas.listMaterials(big.id));
    expect(found).toHaveLength(12);
    expect(bigMaterials).toBeLessThanOrEqual(smallMaterials + 3); // + one title query per type
    const [, smallGoals] = await counted(() => goals.listTreeForArea(small.id));
    const [, bigGoals] = await counted(() => goals.listTreeForArea(big.id));
    expect(bigGoals).toBeLessThanOrEqual(smallGoals + 3);
  });
});

describe("goal area inheritance", () => {
  it("effectiveAreas: empty area follows the parent; a named area stops it", () => {
    const m = areas.effectiveAreas([
      { id: "life", parentId: null, areaId: "A" },
      { id: "y1", parentId: "life", areaId: null },
      { id: "q1", parentId: "y1", areaId: null },
      { id: "y2", parentId: "life", areaId: "B" },
      { id: "q2", parentId: "y2", areaId: null },
      { id: "orphan", parentId: "gone", areaId: null },
      { id: "c1", parentId: "c2", areaId: null },
      { id: "c2", parentId: "c1", areaId: null },
    ]);
    expect(Object.fromEntries(m)).toEqual({
      life: "A",
      y1: "A",
      q1: "A",
      y2: "B",
      q2: "B",
      orphan: null,
      c1: null,
      c2: null,
    });
  });

  it("area page tree and material use the same rule", async () => {
    const A = await areas.create({ title: "연구" });
    const B = await areas.create({ title: "건강" });
    const life = await goals.create({ title: "인생", horizon: "life", areaId: A.id });
    const year = await goals.create({
      title: "연(상속)",
      horizon: "year",
      period: "2027",
      parentId: life.id,
    });
    const q = await goals.create({
      title: "분기(상속)",
      horizon: "quarter",
      period: "2027-Q1",
      parentId: year.id,
    });
    const other = await goals.create({
      title: "연(건강)",
      horizon: "year",
      period: "2027",
      parentId: life.id,
      areaId: B.id,
    });
    const own = await projects.create({ title: "영역 프로젝트", areaId: A.id, goalId: q.id });
    const loose = await projects.create({ title: "영역 없는 프로젝트", goalId: q.id });
    // Another area's project toward the same goal: not listed under A.
    await projects.create({ title: "건강 프로젝트", areaId: B.id, goalId: q.id });
    const paper = await papers.create({ title: "상속 목표 논문" });
    const seminar = await seminars.create({ title: "영역 없는 프로젝트 세미나" });
    const t = await thoughts.create({ title: "건강 목표 생각" });
    await links.link({ type: "goal", id: q.id }, { type: "paper", id: paper.id });
    await links.link({ type: "project", id: loose.id }, { type: "seminar", id: seminar.id });
    await links.link({ type: "goal", id: other.id }, { type: "thought", id: t.id });

    const [root] = await goals.listTreeForArea(A.id);
    expect(root.goal.id).toBe(life.id);
    expect(root.children.map((n) => n.goal.id)).toEqual([year.id]);
    const qNode = root.children[0].children[0];
    expect(qNode.goal.id).toBe(q.id);
    // Only this area's projects are listed; progress still counts all three.
    expect(qNode.projects.map((p) => p.id)).toEqual([own.id]);
    expect((await goals.listTreeForArea(B.id)).map((n) => n.goal.id)).toEqual([other.id]);

    expect(
      (await areas.listMaterials(A.id)).map((m) => [m.title, m.via.map((v) => v.type)]),
    ).toEqual([
      ["상속 목표 논문", ["goal"]],
      ["영역 없는 프로젝트 세미나", ["project"]],
    ]);
    expect((await areas.listMaterials(B.id)).map((m) => m.title)).toEqual(["건강 목표 생각"]);
  });
});
