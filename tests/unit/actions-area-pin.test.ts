import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createRecommendedAreas, setAreaPinned } from "@/app/_actions/areas";
import { areas as areasTable } from "@/db/schema";
import { areas } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
  vi.mocked(revalidatePath).mockClear();
});

describe("area pinning", () => {
  it("pins and unpins without counting as activity", async () => {
    const area = await areas.create({ title: "건강" });
    const old = "2026-01-01T00:00:00.000Z";
    await db.update(areasTable).set({ updatedAt: old }).where(eq(areasTable.id, area.id));
    expect(area.pinnedAt).toBeNull();

    expect(await setAreaPinned(area.id, true)).toEqual({
      ok: true,
      data: { id: area.id, pinned: true },
    });
    const pinned = await areas.get(area.id);
    expect(pinned?.pinnedAt).toEqual(expect.any(String));
    expect(pinned?.updatedAt).toBe(old);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/", "layout");

    expect((await setAreaPinned(area.id, false)).ok).toBe(true);
    expect((await areas.get(area.id))?.pinnedAt).toBeNull();
  });

  it("rejects bad input and unknown areas", async () => {
    const area = await areas.create({ title: "건강" });
    expect((await setAreaPinned(area.id, "yes")).ok).toBe(false);
    expect((await setAreaPinned("not an id", true)).ok).toBe(false);
    const missing = await setAreaPinned("00000000-0000-4000-8000-000000000000", true);
    expect(missing).toMatchObject({ ok: false });
    expect(await areas.pin(area.id)).toBe(true);
    expect(await areas.unpin("00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("pins recommended areas made from the sidebar, but not other new areas", async () => {
    await areas.create({ title: "취미" });
    expect((await createRecommendedAreas(["건강", "학위"])).ok).toBe(true);
    const list = await areas.list();
    const pinned = list.filter((a) => a.pinnedAt).map((a) => a.title);
    expect(pinned.sort()).toEqual(["건강", "학위"].sort());
  });
});
