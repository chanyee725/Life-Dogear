import { beforeEach, describe, expect, it } from "vitest";
import { graphLayout, links as linksTable } from "@/db/schema";
import { archive, areas, goals, links, papers, projects, seminars } from "@/lib/repo";
import { computeProgress, currentPeriod, normalizePeriod } from "@/lib/repo/goals";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

describe("goal periods", () => {
  it("validates per horizon and fills the current period", () => {
    expect(normalizePeriod("life", "2027")).toBeNull();
    expect(normalizePeriod("year", " 2027 ")).toBe("2027");
    expect(normalizePeriod("quarter", "2027-q2")).toBe("2027-Q2");
    expect(() => normalizePeriod("year", "2027-Q1")).toThrow("연도");
    expect(() => normalizePeriod("quarter", "2027-Q5")).toThrow("2027-Q1");
    const nov = new Date(2026, 10, 3);
    expect(currentPeriod("year", nov)).toBe("2026");
    expect(currentPeriod("quarter", nov)).toBe("2026-Q4");
    expect(currentPeriod("life", nov)).toBeNull();
  });
});

describe("goals repo", () => {
  it("creates the life → year → quarter chain and rejects wrong parents", async () => {
    const life = await goals.create({ title: "좋은 연구자", horizon: "life", period: "2027" });
    expect(life).toMatchObject({ horizon: "life", period: null, status: "active" });
    const year = await goals.create({
      title: "1저자 논문",
      horizon: "year",
      period: "2027",
      parentId: life.id,
    });
    const quarter = await goals.create({
      title: "학회 제출본",
      horizon: "quarter",
      period: "2027-Q1",
      parentId: year.id,
      tags: ["논문"],
    });
    expect(quarter.tags).toEqual(["논문"]);
    // A quarter goal sits in its year goal's year; that year is then fixed.
    await expect(
      goals.create({ title: "x", horizon: "quarter", period: "2028-Q1", parentId: year.id }),
    ).rejects.toThrow("상위 연 목표(2027)");
    await expect(goals.update(year.id, { period: "2028" })).rejects.toThrow(
      "연도를 바꿀 수 없습니다",
    );

    await expect(
      goals.create({ title: "x", horizon: "quarter", period: "2027-Q1", parentId: life.id }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      goals.create({ title: "x", horizon: "life", parentId: life.id }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      goals.create({ title: "x", horizon: "year", period: "2027", parentId: "missing" }),
    ).rejects.toMatchObject({ code: "not_found" });

    // Horizon can't change while it has children; without children it needs a fitting period.
    await expect(goals.update(year.id, { horizon: "quarter" })).rejects.toThrow("하위 목표");
    await expect(goals.update(quarter.id, { horizon: "year" })).rejects.toThrow("연도");
    const moved = await goals.update(quarter.id, {
      horizon: "year",
      period: "2027",
      parentId: life.id,
    });
    expect(moved).toMatchObject({ horizon: "year", period: "2027", parentId: life.id });
    expect(await goals.update("missing", { title: "x" })).toBeNull();
    // Self or upward parents are refused; the strict horizon chain rules out cycles.
    await expect(goals.update(moved!.id, { parentId: moved!.id })).rejects.toThrow("자기 자신");
    await expect(goals.update(life.id, { parentId: year.id })).rejects.toThrow("인생 목표");
  });

  it("keeps an archived current parent or area but refuses a new archived one", async () => {
    const area = await areas.create({ title: "연구 분야" });
    const life = await goals.create({ title: "인생", horizon: "life" });
    const year = await goals.create({
      title: "연",
      horizon: "year",
      period: "2027",
      parentId: life.id,
      areaId: area.id,
    });
    await archive.archive({ type: "goal", id: life.id });
    await archive.archive({ type: "area", id: area.id });
    expect(await goals.update(year.id, { title: "연 목표" })).toMatchObject({
      parentId: life.id,
      areaId: area.id,
    });
    await expect(
      goals.create({ title: "x", horizon: "year", period: "2027", parentId: life.id }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      goals.create({ title: "x", horizon: "life", areaId: area.id }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("builds the tree with progress and hides archived goals by default", async () => {
    const life = await goals.create({ title: "인생", horizon: "life" });
    const year = await goals.create({
      title: "연",
      horizon: "year",
      period: "2027",
      parentId: life.id,
    });
    const q1 = await goals.create({
      title: "Q1",
      horizon: "quarter",
      period: "2027-Q1",
      parentId: year.id,
    });
    const q2 = await goals.create({
      title: "Q2",
      horizon: "quarter",
      period: "2027-Q2",
      parentId: year.id,
      progressMode: "manual",
      manualProgress: 20,
    });
    const done = await projects.create({ title: "끝난 일", goalId: q1.id, kind: "general" });
    await projects.update(done.id, { status: "done" });
    const open = await projects.create({ title: "진행 일", goalId: q1.id });
    const paper = await papers.create({ title: "논문" });
    const seminar = await seminars.create({ title: "세미나" });
    const oldPaper = await papers.create({ title: "보관 논문" });
    await links.link({ type: "paper", id: paper.id }, { type: "project", id: open.id });
    await links.link({ type: "project", id: open.id }, { type: "seminar", id: seminar.id });
    await links.link({ type: "project", id: open.id }, { type: "paper", id: oldPaper.id });
    await archive.archive({ type: "paper", id: oldPaper.id });

    const [root] = await goals.listTree();
    expect(root.goal.id).toBe(life.id);
    expect(root.progress).toBeNull();
    const [yearNode] = root.children;
    expect(yearNode.children.map((c) => [c.goal.title, c.progress])).toEqual([
      ["Q1", 50],
      ["Q2", 20],
    ]);
    expect(yearNode.progress).toBe(35);
    expect(yearNode.children[0].projects).toEqual([
      { id: done.id, title: "끝난 일", done: true, resourceCount: 0 },
      { id: open.id, title: "진행 일", done: false, resourceCount: 2 },
    ]);

    await archive.archive({ type: "goal", id: q2.id });
    const [again] = await goals.listTree();
    expect(again.children[0].children.map((c) => c.goal.title)).toEqual(["Q1"]);
    expect(again.children[0].progress).toBe(50);
    expect((await goals.getNode(q2.id))?.goal.id).toBe(q2.id);

    // Archiving the life goal makes the year goal a root.
    await archive.archive({ type: "goal", id: life.id });
    expect((await goals.listTree()).map((n) => n.goal.title)).toEqual(["연"]);
  });

  it("delete keeps children and projects but clears them, plus links and layout", async () => {
    const year = await goals.create({ title: "연", horizon: "year", period: "2027" });
    const q = await goals.create({
      title: "분기",
      horizon: "quarter",
      period: "2027-Q1",
      parentId: year.id,
    });
    const p = await projects.create({ title: "연구", goalId: year.id });
    await links.link({ type: "goal", id: year.id }, { type: "project", id: p.id });
    await db.insert(graphLayout).values({
      nodeType: "goal",
      nodeId: year.id,
      x: 1,
      y: 2,
      updatedAt: "2026-11-03T00:00:00.000Z",
    });

    expect(await goals.remove(year.id)).toBe(true);
    expect((await goals.get(q.id))?.parentId).toBeNull();
    expect((await projects.get(p.id))?.goalId).toBeNull();
    expect(await db.select().from(linksTable)).toEqual([]);
    expect(await db.select().from(graphLayout)).toEqual([]);
    expect(await goals.remove(year.id)).toBe(false);
  });
});

describe("projects.goalId", () => {
  it("assigns, filters, clears and refuses archived or missing goals", async () => {
    const g = await goals.create({ title: "분기", horizon: "quarter", period: "2027-Q1" });
    const p = await projects.create({ title: "연구", goalId: g.id });
    expect(p.goalId).toBe(g.id);
    expect((await projects.list({ goalId: g.id })).map((x) => x.id)).toEqual([p.id]);
    await archive.archive({ type: "goal", id: g.id });
    expect((await projects.update(p.id, { title: "연구 2" }))?.goalId).toBe(g.id);
    await expect(projects.create({ title: "x", goalId: g.id })).rejects.toMatchObject({
      code: "not_found",
    });
    expect((await projects.update(p.id, { goalId: "" }))?.goalId).toBeNull();
    await expect(projects.update(p.id, { goalId: g.id })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("computeProgress", () => {
  const base = { status: "active" as const, progressMode: "auto" as const, manualProgress: null };
  it("follows the horizon rules", () => {
    expect(computeProgress({ ...base, horizon: "life" }, [true], [])).toBeNull();
    expect(computeProgress({ ...base, horizon: "quarter", status: "achieved" }, [], [])).toBe(100);
    expect(computeProgress({ ...base, horizon: "quarter", manualProgress: 40 }, [], [])).toBe(40);
    expect(computeProgress({ ...base, horizon: "quarter" }, [true, false, false], [])).toBe(33);
    expect(
      computeProgress(
        { ...base, horizon: "year" },
        [],
        [
          { status: "active", progress: 100 },
          { status: "dropped", progress: 0 },
          { status: "active", progress: null },
        ],
      ),
    ).toBe(100);
    expect(
      computeProgress(
        { ...base, horizon: "year", progressMode: "manual", manualProgress: 7 },
        [],
        [{ status: "active", progress: 100 }],
      ),
    ).toBe(7);
  });
});

describe("goals.progressFor", () => {
  it("returns progress by id, archived ones only on request", async () => {
    const life = await goals.create({ title: "인생", horizon: "life" });
    const q = await goals.create({
      title: "분기",
      horizon: "quarter",
      period: "2027-Q1",
      progressMode: "manual",
      manualProgress: 60,
    });
    const old = await goals.create({ title: "지난", horizon: "year", period: "2026" });
    await goals.update(old.id, { status: "achieved" });
    await archive.archive({ type: "goal", id: old.id });

    expect(await goals.progressFor()).toEqual({ [life.id]: null, [q.id]: 60 });
    expect(await goals.progressFor([q.id, old.id, "missing"])).toEqual({
      [q.id]: 60,
      [old.id]: 100,
    });
  });
});
