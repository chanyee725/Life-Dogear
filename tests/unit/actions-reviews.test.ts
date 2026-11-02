import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import {
  createGoalFromReview,
  deleteReview,
  openReview,
  setReviewCompleted,
  updateReview,
} from "@/app/reviews/actions";
import { parseFocusField, parseReviewForm } from "@/app/reviews/form";
import { nextGoalTarget } from "@/app/reviews/next-goal";
import { progressChange } from "@/app/reviews/progress";
import { goals, links, projects } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { periodOf } from "@/lib/reviews/period";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
  redirect.mockClear();
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

describe("review form helpers", () => {
  it("parses the focus field and the form patch", () => {
    expect(parseFocusField("project:a, goal:b,,")).toEqual([
      { type: "project", id: "a" },
      { type: "goal", id: "b" },
    ]);
    expect(parseFocusField("")).toEqual([]);
    expect(() => parseFocusField("x".repeat(500))).toThrow();
    expect(parseReviewForm(form({ body: "메모" }))).toEqual({ body: "메모", focus: undefined });
  });

  it("targets next quarter / next year goals", () => {
    expect(nextGoalTarget("quarter", "2026-Q4")).toEqual({
      horizon: "quarter",
      period: "2027-Q1",
      parentHorizon: "year",
      parentPeriod: "2027",
    });
    expect(nextGoalTarget("year", "2026")).toMatchObject({ horizon: "year", period: "2027" });
    expect(nextGoalTarget("week", "2026-W45")).toBeNull();
  });

  it("formats progress change", () => {
    expect(progressChange(60, 50)).toBe("+10");
    expect(progressChange(40, 50)).toBe("−10");
    expect(progressChange(50, 50)).toBe("0");
    expect(progressChange(50, null)).toBe("");
    expect(progressChange(undefined, 10)).toBe("");
  });
});

describe("review actions", () => {
  it("opens the current period once and redirects to it", async () => {
    await expect(openReview(form({ kind: "week" }))).rejects.toThrow(/REDIRECT \/reviews\//);
    await expect(openReview(form({ kind: "week" }))).rejects.toThrow(/REDIRECT \/reviews\//);
    const list = await reviews.list();
    expect(list).toHaveLength(1);
    expect(list[0].period).toBe(periodOf("week", new Date()));
    expect(redirect.mock.calls[0][0]).toBe(redirect.mock.calls[1][0]);

    // Bad period → back to the list of that kind, nothing created.
    await expect(openReview(form({ kind: "month", period: "2026-13" }))).rejects.toThrow(
      "REDIRECT /reviews?kind=month",
    );
    expect(await reviews.list()).toHaveLength(1);
  });

  it("updates, completes and deletes", async () => {
    const project = await projects.create({ title: "연구" });
    const { review } = await reviews.open("week", "2026-W45");
    const saved = await updateReview(
      review.id,
      form({ body: "잘 됐다", focus: `project:${project.id}` }),
    );
    expect(saved.ok).toBe(true);
    expect(await reviews.get(review.id)).toMatchObject({
      body: "잘 됐다",
      focus: [{ type: "project", id: project.id }],
    });
    expect((await updateReview(review.id, form({ focus: "nope:1" }))).ok).toBe(false);
    expect((await updateReview("bad id", form({ body: "x" }))).ok).toBe(false);

    expect((await setReviewCompleted(review.id, true)).ok).toBe(true);
    expect((await reviews.get(review.id))?.completedAt).not.toBeNull();
    expect((await setReviewCompleted(review.id, "yes")).ok).toBe(false);

    expect((await deleteReview(review.id)).ok).toBe(true);
    expect((await deleteReview(review.id)).ok).toBe(false);
  });

  it("creates the next quarter's goal from a quarter review and links it", async () => {
    const year = await goals.create({ title: "2027 목표", horizon: "year", period: "2027" });
    const { review } = await reviews.open("quarter", "2026-Q4");

    const result = await createGoalFromReview(
      review.id,
      // Horizon/period in the form are ignored: the review decides them.
      form({ title: "학회 제출", parentId: year.id, horizon: "life", period: "1999" }),
    );
    expect(result.ok).toBe(true);
    const goal = await goals.get(result.ok ? result.data.id : "");
    expect(goal).toMatchObject({
      title: "학회 제출",
      horizon: "quarter",
      period: "2027-Q1",
      parentId: year.id,
    });
    expect(
      (await links.listConnected({ type: "review", id: review.id })).map((c) => c.ref),
    ).toEqual([{ type: "goal", id: goal!.id }]);

    expect((await createGoalFromReview(review.id, form({ title: "" }))).ok).toBe(false);
    const week = (await reviews.open("week", "2026-W45")).review;
    const refused = await createGoalFromReview(week.id, form({ title: "x" }));
    expect(refused).toEqual({ ok: false, error: "분기·연간 회고에서만 목표를 만들 수 있습니다." });
  });

  it("creates next year's goal from a year review", async () => {
    const { review } = await reviews.open("year", "2026");
    const result = await createGoalFromReview(review.id, form({ title: "내년 목표" }));
    expect(result.ok).toBe(true);
    expect(await goals.get(result.ok ? result.data.id : "")).toMatchObject({
      horizon: "year",
      period: "2027",
    });
  });
});
