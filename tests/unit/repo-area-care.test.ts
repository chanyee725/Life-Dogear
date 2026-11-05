import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { areas as areasTable, goals as goalsTable, tasks as tasksTable } from "@/db/schema";
import { archive, areas, goals, notes, projects, tasks } from "@/lib/repo";
import { summarizeCare } from "@/lib/repo/areas";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

describe("summarizeCare", () => {
  it("folds inherited goals, area-less projects and task parents into their areas", () => {
    const care = summarizeCare({
      areas: [
        { id: "A", updatedAt: "2026-10-01T00:00:00.000Z" },
        { id: "B", updatedAt: "2026-10-01T00:00:00.000Z" },
      ],
      goals: [
        {
          id: "g1",
          parentId: null,
          areaId: "B",
          status: "active",
          updatedAt: "2026-10-02T00:00:00.000Z",
        },
        // No area of its own: counts toward its parent's area B.
        {
          id: "g2",
          parentId: "g1",
          areaId: null,
          status: "achieved",
          updatedAt: "2026-10-05T00:00:00.000Z",
        },
      ],
      projects: [
        {
          id: "p1",
          areaId: "A",
          goalId: null,
          status: "active",
          updatedAt: "2026-10-03T00:00:00.000Z",
        },
        {
          id: "p2",
          areaId: "A",
          goalId: null,
          status: "done",
          updatedAt: "2026-10-04T00:00:00.000Z",
        },
        // Area-less, toward a goal of B.
        {
          id: "p3",
          areaId: null,
          goalId: "g2",
          status: "on_hold",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      tasks: [
        { parentType: "area", parentId: "A", lastUpdated: "2026-10-01T00:00:00.000Z", open: 2 },
        { parentType: "project", parentId: "p3", lastUpdated: "2026-10-09T00:00:00.000Z", open: 1 },
        { parentType: "goal", parentId: "g1", lastUpdated: null, open: 0 },
        // Parent not live (archived or unknown): ignored.
        {
          parentType: "project",
          parentId: "gone",
          lastUpdated: "2026-12-01T00:00:00.000Z",
          open: 5,
        },
      ],
      notes: [
        { areaId: "A", count: 3 },
        // Unknown or no area: ignored.
        { areaId: "gone", count: 2 },
        { areaId: null, count: 4 },
      ],
    });
    expect(care.get("A")).toEqual({
      lastActivity: "2026-10-04T00:00:00.000Z",
      openProjects: 1,
      activeGoals: 0,
      openTasks: 2,
      notes: 3,
    });
    expect(care.get("B")).toEqual({
      lastActivity: "2026-10-09T00:00:00.000Z",
      openProjects: 1,
      activeGoals: 1,
      openTasks: 1,
      notes: 0,
    });
  });
});

describe("areas.listCare", () => {
  it("aggregates projects, goals and tasks per live area", async () => {
    const health = await areas.create({ title: "건강" });
    const study = await areas.create({ title: "공부" });
    const old = "2026-01-01T00:00:00.000Z";
    await db.update(areasTable).set({ updatedAt: old });

    const goal = await goals.create({ title: "체력", horizon: "life", areaId: health.id });
    await db.update(goalsTable).set({ updatedAt: old }).where(eq(goalsTable.id, goal.id));
    const open = await projects.create({ title: "달리기", kind: "general", areaId: health.id });
    await projects.create({ title: "끝난 일", kind: "general", status: "done", areaId: health.id });
    const archived = await projects.create({ title: "보관", kind: "general", areaId: health.id });
    await archive.archive({ type: "project", id: archived.id });
    await tasks.create({ title: "신발 사기", parent: { type: "project", id: open.id } });
    const done = await tasks.create({
      title: "검진 예약",
      parent: { type: "area", id: health.id },
    });
    await tasks.update(done.id, { done: true });
    await tasks.create({ title: "책 고르기", parent: { type: "area", id: study.id } });
    await db
      .update(tasksTable)
      .set({ updatedAt: "2026-02-01T00:00:00.000Z" })
      .where(eq(tasksTable.title, "책 고르기"));

    await notes.create({ title: "식단 기록", areaId: health.id });
    const shelved = await notes.create({ title: "지난 기록", areaId: health.id });
    await archive.archive({ type: "note", id: shelved.id });

    const care = await areas.listCare();
    expect(care.get(health.id)).toMatchObject({
      openProjects: 1,
      activeGoals: 1,
      openTasks: 1,
      notes: 1,
    });
    expect(care.get(health.id)!.lastActivity > old).toBe(true);
    expect(care.get(study.id)).toEqual({
      lastActivity: "2026-02-01T00:00:00.000Z",
      openProjects: 0,
      activeGoals: 0,
      openTasks: 1,
      notes: 0,
    });
  });
});
