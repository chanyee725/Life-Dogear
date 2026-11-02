import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import { archiveItem, unarchiveItem } from "@/app/_actions/archive";
import {
  createArea,
  createRecommendedAreas,
  deleteArea,
  reorderAreas,
  updateArea,
} from "@/app/_actions/areas";
import { areas, papers } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
  vi.mocked(revalidatePath).mockClear();
});

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
};

describe("area actions", () => {
  it("creates, updates, reorders and deletes areas", async () => {
    const a = await createArea(form({ title: "학위", standard: "마감 지키기", tags: ["학교"] }));
    expect(a.ok).toBe(true);
    const id = a.ok ? a.data.id : "";
    expect(await areas.get(id)).toMatchObject({
      title: "학위",
      standard: "마감 지키기",
      tags: ["학교"],
    });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/", "layout");

    expect(await updateArea(id, form({ title: "학위 과정" }))).toEqual({ ok: true, data: { id } });
    expect(await updateArea("seed-area-404", form({ title: "x" }))).toEqual({
      ok: false,
      error: "영역을 찾을 수 없습니다.",
    });
    expect((await createArea(form({ title: " " }))).ok).toBe(false);

    const b = (await areas.create({ title: "건강" })).id;
    expect(await reorderAreas([b, id])).toEqual({ ok: true, data: null });
    expect((await areas.list()).map((x) => x.id)).toEqual([b, id]);
    expect((await reorderAreas("nope")).ok).toBe(false);
    expect((await reorderAreas([b])).ok).toBe(false);

    expect(await deleteArea(id)).toEqual({ ok: true, data: null });
    expect(await deleteArea(id)).toEqual({ ok: false, error: "영역을 찾을 수 없습니다." });
  });

  it("creates only chosen recommended areas, once", async () => {
    const res = await createRecommendedAreas(["건강", "연구 분야"]);
    expect(res.ok && res.data.ids.length).toBe(2);
    // Recommended order is kept, with suggested standards.
    const list = await areas.list();
    expect(list.map((a) => a.title)).toEqual(["연구 분야", "건강"]);
    expect(list[0].standard).not.toBe("");
    const again = await createRecommendedAreas(["건강", "학위"]);
    expect(again.ok && again.data.ids.length).toBe(1);
    expect(again.ok && again.data.skipped).toEqual([{ title: "건강", archived: false }]);
    expect(await areas.list()).toHaveLength(3);
    expect((await createRecommendedAreas(["취미"])).ok).toBe(false);
    expect((await createRecommendedAreas([])).ok).toBe(false);
    expect((await createRecommendedAreas("건강")).ok).toBe(true);
  });
});

describe("archive actions", () => {
  it("archives and unarchives with validation", async () => {
    const p = await papers.create({ title: "논문" });
    const ref = { type: "paper", id: p.id };
    expect(await archiveItem(ref)).toEqual({ ok: true, data: null });
    expect(await papers.list()).toEqual([]);
    expect(await unarchiveItem(ref)).toEqual({ ok: true, data: null });
    expect(await papers.list()).toHaveLength(1);
    expect(await archiveItem({ type: "paper", id: "seed-paper-404" })).toEqual({
      ok: false,
      error: "항목을 찾을 수 없습니다.",
    });
    expect((await archiveItem({ type: "note", id: p.id })).ok).toBe(false);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/", "layout");
  });
});
