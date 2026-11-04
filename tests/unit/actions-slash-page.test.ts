import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createSlashPage } from "@/app/_actions/slash-page";
import { areas, links, notes, projects } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

describe("createSlashPage", () => {
  it("creates a note linked to a project or a note", async () => {
    const project = await projects.create({ title: "프로젝트" });
    const P = { type: "project" as const, id: project.id };
    const res = await createSlashPage("  새  페이지 ", P);
    expect(res).toMatchObject({ ok: true, data: { title: "새 페이지" } });
    const ref = res.ok ? res.data.ref : null;
    expect(ref?.type).toBe("note");
    expect((await notes.get(ref!.id))?.title).toBe("새 페이지");
    expect((await links.listConnected(P)).map((s) => s.ref)).toEqual([ref]);

    const N = ref!;
    const child = await createSlashPage("하위", N);
    expect((await links.listConnected(N)).map((s) => s.title).sort()).toEqual(["프로젝트", "하위"]);
    expect(child.ok).toBe(true);
  });

  it("files the note under an area instead of linking", async () => {
    const area = await areas.create({ title: "건강" });
    const A = { type: "area" as const, id: area.id };
    const res = await createSlashPage("운동 기록", A);
    const id = res.ok ? res.data.ref.id : "";
    expect((await notes.get(id))?.areaId).toBe(area.id);
    expect(await links.listConnected(A)).toEqual([]);
  });

  it("rejects an empty title or an unknown document", async () => {
    const project = await projects.create({ title: "p" });
    expect(await createSlashPage("  ", { type: "project", id: project.id })).toMatchObject({
      ok: false,
    });
    expect(
      await createSlashPage("x", {
        type: "project",
        id: "0b4f9f7e-2d5c-4a51-9a39-6f0c4b6b9c11",
      }),
    ).toMatchObject({ ok: false, error: "문서를 찾을 수 없습니다." });
    expect(await createSlashPage("x", null)).toMatchObject({ ok: false });
    expect((await notes.list()).length).toBe(0);
  });
});
