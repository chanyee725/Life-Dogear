import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  countWikiMentions,
  createThoughtForTitle,
  renameWikiMentions,
  resolveWikiTitles,
} from "@/app/_actions/wikilinks";
import { links, papers, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

describe("wiki link actions", () => {
  it("resolves titles and validates input", async () => {
    const p = await papers.create({ title: "논문 A" });
    expect(await resolveWikiTitles(["논문 a", "없음"])).toEqual({
      ok: true,
      data: {
        "논문 a": {
          ref: { type: "paper", id: p.id },
          type: "paper",
          title: "논문 A",
          archived: false,
        },
      },
    });
    expect(await resolveWikiTitles("nope")).toMatchObject({ ok: true });
    expect(await resolveWikiTitles(Array(201).fill("x"))).toMatchObject({ ok: false });
  });

  it("creates a thought for a gray title and links it from the source body", async () => {
    const src = await thoughts.create({ title: "출처", body: "[[새 생각]] 쓰기" });
    const S = { type: "thought" as const, id: src.id };
    const res = await createThoughtForTitle(" 새  생각 ", S);
    expect(res.ok).toBe(true);
    const ref = res.ok ? res.data.ref : null;
    expect((await thoughts.get(ref!.id))?.title).toBe("새 생각");
    expect(await links.listConnected(S)).toEqual([
      { ref, type: "thought", title: "새 생각", archived: false },
    ]);
    // Asking again returns the existing item instead of a duplicate.
    expect(await createThoughtForTitle("새 생각", S)).toEqual({ ok: true, data: { ref } });
    expect(await createThoughtForTitle("  ")).toMatchObject({ ok: false });
  });

  it("renames mentions only after the new title is saved", async () => {
    const p = await papers.create({ title: "옛" });
    await thoughts.create({ title: "생각", body: "[[옛]]" });
    const P = { type: "paper" as const, id: p.id };
    expect(await countWikiMentions(P, "옛")).toEqual({ ok: true, data: { count: 1 } });
    expect(await renameWikiMentions(P, "옛", "새")).toEqual({
      ok: false,
      error: "새 제목이 아직 저장되지 않았습니다. 잠시 후 다시 시도하세요.",
    });
    await papers.update(p.id, { title: "새" });
    expect(await renameWikiMentions(P, "옛", "새")).toEqual({ ok: true, data: { count: 1 } });
    expect(await countWikiMentions(P, "옛")).toEqual({ ok: true, data: { count: 0 } });
  });
});
