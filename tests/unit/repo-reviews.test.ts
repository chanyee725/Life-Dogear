import { beforeEach, describe, expect, it } from "vitest";
import {
  goals,
  links as linksTable,
  projects as projectsTable,
  reviews as reviewsTable,
} from "@/db/schema";
import { links, papers, projects, RepoError } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { useFreshDb } from "./repo-helpers";

const T = "2026-11-03T00:00:00.000Z";
let db: Awaited<ReturnType<typeof useFreshDb>>;

beforeEach(async () => {
  db = await useFreshDb();
});

async function seedGoals() {
  const goal = (id: string, extra: Partial<typeof goals.$inferInsert>) => ({
    id,
    title: id,
    horizon: "quarter" as const,
    createdAt: T,
    updatedAt: T,
    ...extra,
  });
  await db
    .insert(goals)
    .values([
      goal("seed-life", { horizon: "life", title: "좋은 연구자" }),
      goal("seed-y2026", {
        horizon: "year",
        period: "2026",
        parentId: "seed-life",
        title: "논문 게재",
      }),
      goal("seed-q4", { period: "2026-Q4", parentId: "seed-y2026", title: "학회 제출본" }),
      goal("seed-q3", { period: "2026-Q3", parentId: "seed-y2026", status: "achieved" }),
      goal("seed-q1-next", { period: "2027-Q1" }),
      goal("seed-q4-manual", { period: "2026-Q4", progressMode: "manual", manualProgress: 40 }),
    ]);
  const a = await projects.create({ title: "A" });
  const b = await projects.create({ title: "B" });
  await db.update(projectsTable).set({ goalId: "seed-q4" });
  await projects.update(a.id, { kind: "general", status: "done" });
  return { a, b };
}

describe("reviews repo", () => {
  it("opens one review per kind and period, with a title, template and snapshot", async () => {
    await seedGoals();
    const first = await reviews.open("week", "2026-W45");
    expect(first.created).toBe(true);
    expect(first.review).toMatchObject({
      kind: "week",
      period: "2026-W45",
      title: "2026-W45 주간 회고",
      focus: [],
      completedAt: null,
    });
    expect(first.review.body).toContain("## 회고 메모");
    // Quarter goals of 2026-Q4 and the 2026 year goal; q4: 1 of 2 projects done.
    expect(first.review.goalProgress).toEqual({
      "seed-y2026": 75, // mean of q4 (50) and q3 (achieved, 100)
      "seed-q4": 50,
      "seed-q4-manual": 40,
    });

    const again = await reviews.open("week", "2026-W45");
    expect(again.created).toBe(false);
    expect(again.review.id).toBe(first.review.id);
    expect(await db.select().from(reviewsTable)).toHaveLength(1);
  });

  it("lists quarter goals in the quarter template and rejects bad periods", async () => {
    await seedGoals();
    const { review } = await reviews.open("quarter", "2026-Q4");
    expect(review.body).toContain("- 학회 제출본: 달성 / 진행 / 내려놓음");
    expect(review.body).toContain("## 다음 분기 목표 초안");
    expect((await reviews.open("year", "2026")).review.body).toContain("- 논문 게재:");

    await expect(reviews.open("week", "2026-W60")).rejects.toBeInstanceOf(RepoError);
    await expect(reviews.open("month", "2026-Q4")).rejects.toMatchObject({ code: "invalid" });
    await expect(reviews.open("day" as never, "2026")).rejects.toMatchObject({ code: "invalid" });
  });

  it("updates body and focus (≤ 3), and refreshes the snapshot on completion", async () => {
    const { a, b } = await seedGoals();
    const paper = await papers.create({ title: "논문" });
    const { review } = await reviews.open("week", "2026-W45");
    const A = { type: "project" as const, id: a.id };
    const B = { type: "project" as const, id: b.id };
    const P = { type: "paper" as const, id: paper.id };

    const updated = await reviews.update(review.id, { body: "메모", focus: [A, B, A] });
    expect(updated).toMatchObject({ body: "메모", focus: [A, B] });
    await expect(
      reviews.update(review.id, { focus: [A, B, P, { type: "goal", id: "seed-q4" }] }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      reviews.update(review.id, { focus: [{ type: "x", id: "1" }] }),
    ).rejects.toBeInstanceOf(RepoError);

    await projects.update(b.id, { kind: "general", status: "done" });
    const done = await reviews.update(review.id, { completed: true });
    expect(done?.completedAt).not.toBeNull();
    expect(done?.goalProgress["seed-q4"]).toBe(100);
    expect((await reviews.update(review.id, { completed: false }))?.completedAt).toBeNull();
    expect(await reviews.update("seed-missing", { body: "x" })).toBeNull();
  });

  it("lists newest period first, by kind, and finds the previous review", async () => {
    const w44 = (await reviews.open("week", "2026-W44")).review;
    const w45 = (await reviews.open("week", "2026-W45")).review;
    await reviews.open("month", "2026-11");
    expect((await reviews.list({ kind: "week" })).map((r) => r.period)).toEqual([
      "2026-W45",
      "2026-W44",
    ]);
    expect(await reviews.list()).toHaveLength(3);
    expect((await reviews.findPrevious(w45))?.id).toBe(w44.id);
    expect(await reviews.findPrevious(w44)).toBeNull();
    expect(await reviews.existingPeriods("week", ["2026-W45", "2026-W46"])).toEqual(
      new Set(["2026-W45"]),
    );
  });

  it("removes a review with its links", async () => {
    const { review } = await reviews.open("week", "2026-W45");
    const paper = await papers.create({ title: "논문" });
    await links.link({ type: "review", id: review.id }, { type: "paper", id: paper.id });
    expect(await reviews.remove(review.id)).toBe(true);
    expect(await reviews.get(review.id)).toBeNull();
    expect(await db.select().from(linksTable)).toHaveLength(0);
    expect(await reviews.remove(review.id)).toBe(false);
  });

  it("tolerates corrupt JSON columns", async () => {
    const { review } = await reviews.open("week", "2026-W45");
    await db.update(reviewsTable).set({ focus: "nope", goalProgress: "[1]" });
    expect(await reviews.get(review.id)).toMatchObject({ focus: [], goalProgress: {} });
  });
});
