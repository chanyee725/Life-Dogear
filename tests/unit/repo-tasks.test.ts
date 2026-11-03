import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { tasks as tasksTable } from "@/db/schema";
import { archive, areas, goals, projects, RepoError, tasks } from "@/lib/repo";
import { computeProgress } from "@/lib/repo/goals";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

const setDoneAt = (id: string, doneAt: string | null) =>
  db.update(tasksTable).set({ doneAt }).where(eq(tasksTable.id, id));

describe("tasks repo: create and validate", () => {
  it("appends to the parent's list with the parent's title", async () => {
    const p = await projects.create({ title: "프로젝트" });
    const parent = { type: "project" as const, id: p.id };
    const a = await tasks.create({ title: "  첫  번째 ", parent });
    const b = await tasks.create({ title: "두 번째", parent, dueDate: "2026-11-05" });
    const inbox = await tasks.create({ title: "수집함" });
    expect(a).toMatchObject({
      title: "첫 번째",
      sortOrder: 0,
      parentTitle: "프로젝트",
      doneAt: null,
    });
    expect(b).toMatchObject({ sortOrder: 1, dueDate: "2026-11-05" });
    expect(inbox).toMatchObject({ parentType: null, parentId: null, sortOrder: 0 });
    expect(inbox.parentTitle).toBeUndefined();
    expect((await tasks.list({ parent })).map((t) => t.id)).toEqual([a.id, b.id]);
    expect((await tasks.list({ parent: null })).map((t) => t.id)).toEqual([inbox.id]);
  });

  it("refuses bad titles, dates and parents", async () => {
    await expect(tasks.create({ title: "   " })).rejects.toMatchObject({ code: "invalid" });
    await expect(tasks.create({ title: "가".repeat(301) })).rejects.toMatchObject({
      code: "invalid",
    });
    expect((await tasks.create({ title: "가".repeat(300) })).title).toHaveLength(300);
    await expect(tasks.create({ title: "x", dueDate: "2026-13-40" })).rejects.toBeInstanceOf(
      RepoError,
    );
    await expect(
      tasks.create({ title: "x", parent: { type: "paper" as "project", id: "p" } }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      tasks.create({ title: "x", parent: { type: "goal", id: "missing" } }),
    ).rejects.toMatchObject({ code: "not_found" });
    const area = await areas.create({ title: "영역" });
    await archive.archive({ type: "area", id: area.id });
    await expect(
      tasks.create({ title: "x", parent: { type: "area", id: area.id } }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("gives concurrent creates distinct orders", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => tasks.create({ title: `t${i}` })));
    const orders = (await tasks.list({ parent: null })).map((t) => t.sortOrder);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("tasks repo: update, order, remove", () => {
  it("checks and unchecks, keeping the first completion time", async () => {
    const t = await tasks.create({ title: "할 일" });
    const done = (await tasks.update(t.id, { done: true }))!;
    expect(done.doneAt).not.toBeNull();
    await setDoneAt(t.id, "2026-01-01T00:00:00.000Z");
    expect((await tasks.update(t.id, { done: true, title: "고침" }))!).toMatchObject({
      doneAt: "2026-01-01T00:00:00.000Z",
      title: "고침",
    });
    expect((await tasks.update(t.id, { done: false, dueDate: null }))!.doneAt).toBeNull();
    expect(await tasks.update("missing", { done: true })).toBeNull();
  });

  it("moves within the parent and reorders the whole list", async () => {
    const g = await goals.create({ title: "목표" });
    const parent = { type: "goal" as const, id: g.id };
    const [a, b, c] = [
      await tasks.create({ title: "a", parent }),
      await tasks.create({ title: "b", parent }),
      await tasks.create({ title: "c", parent }),
    ];
    const other = await tasks.create({ title: "inbox" });
    const order = async () => (await tasks.list({ parent })).map((t) => t.title);

    expect(await tasks.move(c!.id, "up")).toBe(true);
    expect(await order()).toEqual(["a", "c", "b"]);
    expect(await tasks.move(a!.id, "up")).toBe(false);
    expect(await tasks.move(b!.id, "down")).toBe(false);
    expect(await tasks.move("missing", "down")).toBe(false);

    await tasks.reorder(parent, [b!.id, a!.id, c!.id]);
    expect(await order()).toEqual(["b", "a", "c"]);
    await expect(tasks.reorder(parent, [a!.id, b!.id])).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(tasks.reorder(parent, [a!.id, b!.id, other.id])).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(tasks.reorder(parent, [a!.id, a!.id, c!.id])).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("removes a task, and a deleted parent takes its tasks along", async () => {
    const p = await projects.create({ title: "p" });
    const g = await goals.create({ title: "g" });
    const ar = await areas.create({ title: "a" });
    const t = await tasks.create({ title: "t" });
    for (const parent of [
      { type: "project" as const, id: p.id },
      { type: "goal" as const, id: g.id },
      { type: "area" as const, id: ar.id },
    ]) {
      await tasks.create({ title: "child", parent });
    }
    expect(await tasks.remove(t.id)).toBe(true);
    expect(await tasks.remove(t.id)).toBe(false);
    await projects.remove(p.id);
    await goals.remove(g.id);
    await areas.remove(ar.id);
    expect(await db.select().from(tasksTable)).toEqual([]);
  });
});

describe("tasks repo: lists", () => {
  it("lists today, overdue and this week, hiding archived parents", async () => {
    const p = await projects.create({ title: "보관할 프로젝트" });
    const parent = { type: "project" as const, id: p.id };
    const today = await tasks.create({ title: "오늘", dueDate: "2026-11-03" });
    const late = await tasks.create({ title: "지남", dueDate: "2026-11-01" });
    const week = await tasks.create({ title: "이번 주", dueDate: "2026-11-08" });
    const later = await tasks.create({ title: "다음 주", dueDate: "2026-11-09" });
    const doneLate = await tasks.create({ title: "끝남", dueDate: "2026-11-01" });
    await tasks.update(doneLate.id, { done: true });
    const hidden = await tasks.create({ title: "숨김", parent, dueDate: "2026-11-02" });
    await tasks.create({ title: "마감 없음" });

    const before = await tasks.listToday("2026-11-03");
    expect(before.today.map((t) => t.id)).toEqual([today.id]);
    expect(before.overdue.map((t) => t.id)).toEqual([late.id, hidden.id]);
    expect((await tasks.listThisWeek("2026-11-02", "2026-11-08")).map((t) => t.id)).toEqual([
      hidden.id,
      today.id,
      week.id,
    ]);

    await archive.archive({ type: "project", id: p.id });
    expect((await tasks.listToday("2026-11-03")).overdue.map((t) => t.id)).toEqual([late.id]);
    expect(await tasks.list({ parent })).toEqual([]);
    expect((await tasks.list({ parent, includeArchivedParents: true })).map((t) => t.id)).toEqual([
      hidden.id,
    ]);

    expect(
      (await tasks.list({ done: false, dueFrom: "2026-11-03", dueBefore: "2026-11-09" })).map(
        (t) => t.title,
      ),
    ).toEqual(["오늘", "이번 주"]);
    expect((await tasks.list({ done: true })).map((t) => t.id)).toEqual([doneLate.id]);
    expect((await tasks.list({ dueBefore: "2026-11-09" })).map((t) => t.id)).not.toContain(
      later.id,
    );
    await expect(tasks.listToday("어제")).rejects.toBeInstanceOf(RepoError);
  });

  it("lists completions in the half-open ISO range [from, to)", async () => {
    const p = await projects.create({ title: "p" });
    const ids: Record<string, string> = {};
    for (const [name, doneAt] of [
      ["before", "2026-11-01T14:59:59.999Z"],
      ["start", "2026-11-01T15:00:00.000Z"],
      ["mid", "2026-11-05T09:00:00.000Z"],
      ["end", "2026-11-08T15:00:00.000Z"],
    ] as const) {
      const t = await tasks.create({ title: name, parent: { type: "project", id: p.id } });
      await setDoneAt(t.id, doneAt);
      ids[name] = t.id;
    }
    await tasks.create({ title: "open" });
    await archive.archive({ type: "project", id: p.id });
    const got = await tasks.listCompletedBetween(
      "2026-11-01T15:00:00.000Z",
      "2026-11-08T15:00:00.000Z",
    );
    expect(got.map((t) => t.title)).toEqual(["start", "mid"]);
    expect(got[0]!.parentTitle).toBe("p");
    await expect(tasks.listCompletedBetween("2026-11-01", "2026-11-08")).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("counts done/total per parent in one go", async () => {
    const p = await projects.create({ title: "p" });
    const g = await goals.create({ title: "g" });
    const pp = { type: "project" as const, id: p.id };
    const a = await tasks.create({ title: "a", parent: pp });
    await tasks.create({ title: "b", parent: pp });
    await tasks.update(a.id, { done: true });
    await tasks.create({ title: "inbox" });
    expect(await tasks.countFor([pp, { type: "goal", id: g.id }, null])).toEqual({
      [`project:${p.id}`]: { done: 1, total: 2 },
      [`goal:${g.id}`]: { done: 0, total: 0 },
      inbox: { done: 0, total: 1 },
    });
    expect(await tasks.countFor([])).toEqual({});
  });
});

describe("quarter goal progress with tasks", () => {
  const base = {
    horizon: "quarter" as const,
    status: "active" as const,
    progressMode: "auto" as const,
    manualProgress: 10,
  };

  it("uses projects first, then direct tasks, then the manual value", () => {
    expect(computeProgress(base, [true, false], [], { done: 3, total: 3 })).toBe(50);
    expect(computeProgress(base, [], [], { done: 1, total: 3 })).toBe(33);
    expect(computeProgress(base, [], [], { done: 0, total: 0 })).toBe(10);
    expect(computeProgress({ ...base, horizon: "year" }, [], [], { done: 1, total: 1 })).toBe(10);
    expect(
      computeProgress({ ...base, progressMode: "manual" }, [], [], { done: 1, total: 1 }),
    ).toBe(10);
  });

  it("feeds goal tasks into progressFor", async () => {
    const g = await goals.create({ title: "분기", horizon: "quarter", period: "2027-Q1" });
    const parent = { type: "goal" as const, id: g.id };
    const a = await tasks.create({ title: "a", parent });
    await tasks.create({ title: "b", parent });
    await tasks.update(a.id, { done: true });
    expect(await goals.progressFor([g.id])).toEqual({ [g.id]: 50 });

    const p = await projects.create({ title: "p", goalId: g.id });
    await projects.update(p.id, { status: "done" });
    expect(await goals.progressFor([g.id])).toEqual({ [g.id]: 100 });
  });
});
