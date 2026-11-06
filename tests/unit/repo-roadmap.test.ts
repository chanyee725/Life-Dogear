import { beforeEach, describe, expect, it } from "vitest";
import { archive, areas, goals, projects, tasks } from "@/lib/repo";
import { buildRoadmap, NO_AREA_ID } from "@/lib/repo/roadmap";
import type { RoadmapNode } from "@/lib/repo/roadmap-types";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

/** Compact shape: `kind:title` with children. */
type Shape = string | [string, Shape[]];
const shape = (n: RoadmapNode): Shape =>
  n.children.length ? [`${n.kind}:${n.title}`, n.children.map(shape)] : `${n.kind}:${n.title}`;

async function seed() {
  const area = await areas.create({ title: "연구" });
  const life = await goals.create({ title: "좋은 연구자", horizon: "life", areaId: area.id });
  const year = await goals.create({
    title: "1저자 논문",
    horizon: "year",
    period: "2027",
    parentId: life.id,
  });
  const quarter = await goals.create({
    title: "학회 제출",
    horizon: "quarter",
    period: "2027-Q1",
    parentId: year.id,
  });
  const paper = await projects.create({
    title: "논문 A",
    goalId: quarter.id,
    dueDate: "2027-03-01",
  });
  const loose = await projects.create({ title: "실험 정리", areaId: area.id });
  const orphanGoal = await goals.create({ title: "운동", horizon: "year", period: "2027" });
  const orphanProject = await projects.create({ title: "아무 데도", kind: "general" });
  return { area, life, year, quarter, paper, loose, orphanGoal, orphanProject };
}

describe("buildRoadmap", () => {
  it("nests goals by level, puts goal-less projects under the area, and adds 영역 없음", async () => {
    const s = await seed();
    const data = await buildRoadmap();
    expect(data.includeDone).toBe(false);
    expect(data.roots.map(shape)).toEqual([
      [
        "area:연구",
        [
          ["goal:좋은 연구자", [["goal:1저자 논문", [["goal:학회 제출", ["project:논문 A"]]]]]],
          "project:실험 정리",
        ],
      ],
      ["area:영역 없음", ["goal:운동", "project:아무 데도"]],
    ]);
    const none = data.roots[1]!;
    expect(none).toMatchObject({ kind: "area", id: NO_AREA_ID, href: null });
    const quarter = data.roots[0]!.children[0]!.children[0]!.children[0]!;
    expect(quarter).toMatchObject({ id: s.quarter.id, due: "2027-Q1", status: "active" });
    expect(quarter.href).toMatch(/^\/goals\//);
    expect(quarter.children[0]).toMatchObject({ due: "2027-03-01", progress: null });
  });

  it("orders a project's tasks by sortOrder and links them to the project", async () => {
    const s = await seed();
    const parent = { type: "project" as const, id: s.loose.id };
    const a = await tasks.create({ title: "첫째", parent });
    const b = await tasks.create({ title: "둘째", parent, dueDate: "2027-01-10" });
    const c = await tasks.create({ title: "셋째", parent });
    await tasks.reorder(parent, [c.id, a.id, b.id]);
    await tasks.update(a.id, { done: true });

    const loose = (await buildRoadmap()).roots[0]!.children[1]!;
    expect(loose.children.map((t) => t.title)).toEqual(["셋째", "둘째"]);
    expect(loose.progress).toBeCloseTo(1 / 3);
    expect(loose.children[1]).toMatchObject({
      kind: "task",
      href: loose.href,
      due: "2027-01-10",
      done: false,
    });

    const all = (await buildRoadmap({ includeDone: true })).roots[0]!.children[1]!;
    expect(all.children.map((t) => [t.title, t.done])).toEqual([
      ["셋째", false],
      ["첫째", true],
      ["둘째", false],
    ]);
  });

  it("hides done/dropped goals, done projects and archived items unless includeDone", async () => {
    const s = await seed();
    await goals.update(s.year.id, { status: "achieved" });
    await goals.update(s.orphanGoal.id, { status: "dropped" });
    await projects.update(s.loose.id, { status: "done" });
    await projects.update(s.orphanProject.id, { status: "on_hold" });
    const archived = await areas.create({ title: "보관된 영역" });
    await archive.archive({ type: "area", id: archived.id });
    const gone = await projects.create({ title: "보관된 프로젝트" });
    await archive.archive({ type: "project", id: gone.id });

    // The achieved year goal's quarter child moves up under the life goal.
    expect((await buildRoadmap()).roots.map(shape)).toEqual([
      ["area:연구", [["goal:좋은 연구자", [["goal:학회 제출", ["project:논문 A"]]]]]],
      ["area:영역 없음", ["project:아무 데도"]],
    ]);

    const all = await buildRoadmap({ includeDone: true });
    expect(all.includeDone).toBe(true);
    expect(all.roots.map(shape)).toEqual([
      [
        "area:연구",
        [
          ["goal:좋은 연구자", [["goal:1저자 논문", [["goal:학회 제출", ["project:논문 A"]]]]]],
          "project:실험 정리",
        ],
      ],
      ["area:영역 없음", ["goal:운동", "project:아무 데도"]],
    ]);
    const year = all.roots[0]!.children[0]!.children[0]!;
    expect(year).toMatchObject({ status: "achieved", progress: 1 });
    expect(all.roots[0]!.children[1]).toMatchObject({ status: "done", progress: 1 });
  });

  it("omits 영역 없음 when everything has an area", async () => {
    const area = await areas.create({ title: "건강" });
    await goals.create({ title: "체력", horizon: "life", areaId: area.id });
    expect((await buildRoadmap()).roots.map((r) => r.id)).toEqual([area.id]);
  });
});
