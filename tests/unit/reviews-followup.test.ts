import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createGoalFromReview } from "@/app/reviews/actions";
import { staleFocusOptions } from "@/app/reviews/focus-options";
import { goals as goalsTable, reviews as reviewsTable } from "@/db/schema";
import { archive, goals, links, projects } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

describe("reviews.open", () => {
  it("creates one review when opened twice at once", async () => {
    const [a, b] = await Promise.all([
      reviews.open("week", "2026-W45"),
      reviews.open("week", "2026-W45"),
    ]);
    expect(a.review.id).toBe(b.review.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    expect(await db.select().from(reviewsTable)).toHaveLength(1);
  });

  it("finds an archived review of the period (the list button opens it)", async () => {
    const { review } = await reviews.open("week", "2026-W45");
    await archive.archive({ type: "review", id: review.id });
    expect((await reviews.findByPeriod("week", "2026-W45"))?.id).toBe(review.id);
    expect(await reviews.list()).toEqual([]);
  });
});

describe("review focus", () => {
  it("checks new picks exist and drops saved ones that were deleted", async () => {
    const { review } = await reviews.open("week", "2026-W45");
    const p = await projects.create({ title: "연구" });
    const P = { type: "project" as const, id: p.id };
    await expect(
      reviews.update(review.id, { focus: [{ type: "project", id: "seed-project-404" }] }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await reviews.update(review.id, { focus: [P] }))?.focus).toEqual([P]);
    await projects.remove(p.id);
    // Saving again with the deleted pick still listed: it is dropped, not an error.
    expect((await reviews.update(review.id, { focus: [P] }))?.focus).toEqual([]);
  });

  it("labels picks that left the choices", async () => {
    const done = await projects.create({ title: "끝난 일", kind: "general" });
    await projects.update(done.id, { status: "done" });
    const old = await projects.create({ title: "보관한 일" });
    await archive.archive({ type: "project", id: old.id });
    const g = await goals.create({ title: "지난 분기", horizon: "quarter", period: "2026-Q3" });
    const live = await projects.create({ title: "진행 중" });
    const focus = [
      { type: "project" as const, id: done.id },
      { type: "project" as const, id: old.id },
      { type: "goal" as const, id: g.id },
      { type: "project" as const, id: "seed-project-404" },
      { type: "project" as const, id: live.id },
    ];
    const stale = await staleFocusOptions(focus, [{ key: `project:${live.id}`, label: "진행 중" }]);
    expect(stale).toEqual([
      { key: `project:${done.id}`, label: "끝난 일", hint: "프로젝트 (완료)", stale: true },
      { key: `project:${old.id}`, label: "보관한 일", hint: "프로젝트 (보관)", stale: true },
      { key: `goal:${g.id}`, label: "지난 분기", hint: "목표 (다른 기간)", stale: true },
      { key: "project:seed-project-404", label: "삭제된 항목", hint: "(삭제됨)", gone: true },
    ]);
  });
});

describe("createGoalFromReview", () => {
  it("creates the goal and its link together, or neither", async () => {
    const { review } = await reviews.open("quarter", "2026-Q4");
    // A missing parent fails inside the transaction: no goal is left behind.
    const failed = await createGoalFromReview(
      review.id,
      form({ title: "목표", parentId: "seed-goal-404" }),
    );
    expect(failed).toEqual({ ok: false, error: "상위 목표를 찾을 수 없습니다." });
    expect(await db.select().from(goalsTable)).toEqual([]);

    const ok = await createGoalFromReview(review.id, form({ title: "목표" }));
    expect(ok.ok).toBe(true);
    expect(
      (await links.listConnected({ type: "review", id: review.id })).map((c) => c.ref.id),
    ).toEqual([ok.ok ? ok.data.id : ""]);
  });
});
