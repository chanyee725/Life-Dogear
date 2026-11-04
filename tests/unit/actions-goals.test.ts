import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createGoal, deleteGoal, updateGoal } from "@/app/goals/actions";
import { updateProject } from "@/app/projects/actions";
import { goals, projects } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
};

describe("goal actions", () => {
  it("creates, patches and deletes goals with Korean errors", async () => {
    const life = await createGoal(form({ title: "건강하게", horizon: "life", period: "" }));
    expect(life.ok).toBe(true);
    const lifeId = life.ok ? life.data.id : "";

    const year = await createGoal(
      form({ title: "마라톤", horizon: "year", period: "2027", parentId: lifeId, tags: ["운동"] }),
    );
    const yearId = year.ok ? year.data.id : "";
    expect(await goals.get(yearId)).toMatchObject({
      parentId: lifeId,
      period: "2027",
      tags: ["운동"],
    });

    expect(
      await updateGoal(yearId, form({ progressMode: "manual", manualProgress: "30" })),
    ).toEqual({ ok: true, data: { id: yearId } });
    expect(await goals.get(yearId)).toMatchObject({ progressMode: "manual", manualProgress: 30 });
    expect(await updateGoal(yearId, form({ manualProgress: "130" }))).toEqual({
      ok: false,
      error: "진행률은 0에서 100 사이로 입력하세요.",
    });
    expect(await updateGoal(yearId, form({ manualProgress: "" }))).toMatchObject({ ok: true });
    expect((await goals.get(yearId))?.manualProgress).toBeNull();
    expect(await updateGoal(yearId, form({ parentId: "" }))).toMatchObject({ ok: true });
    expect((await goals.get(yearId))?.parentId).toBeNull();

    expect(await updateGoal(yearId, form({ horizon: "nope" }))).toMatchObject({ ok: false });
    expect(await createGoal(form({ title: " ", horizon: "life" }))).toMatchObject({ ok: false });
    expect(await updateGoal("seed-goal-404", form({ title: "x" }))).toEqual({
      ok: false,
      error: "목표를 찾을 수 없습니다.",
    });

    expect(await deleteGoal(lifeId)).toEqual({ ok: true, data: null });
    expect(await deleteGoal(lifeId)).toEqual({ ok: false, error: "목표를 찾을 수 없습니다." });
  });

  it("keeps createdAt when the goal is edited", async () => {
    const made = await createGoal(form({ title: "독서", horizon: "year", period: "2027" }));
    const id = made.ok ? made.data.id : "";
    const createdAt = (await goals.get(id))?.createdAt;
    expect(createdAt).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));
    expect(
      await updateGoal(id, form({ title: "독서 50권", why: "생각의 폭", status: "achieved" })),
    ).toMatchObject({ ok: true });
    expect(await goals.get(id)).toMatchObject({ title: "독서 50권", createdAt });
  });

  it("lets a project pick and clear its goal", async () => {
    const g = await goals.create({ title: "분기", horizon: "quarter", period: "2027-Q1" });
    const p = await projects.create({ title: "연구" });
    expect(await updateProject(p.id, form({ goalId: g.id }))).toMatchObject({ ok: true });
    expect((await projects.get(p.id))?.goalId).toBe(g.id);
    expect(await updateProject(p.id, form({ goalId: "" }))).toMatchObject({ ok: true });
    expect((await projects.get(p.id))?.goalId).toBeNull();
  });
});
