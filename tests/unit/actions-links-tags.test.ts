import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import { searchItemTitles } from "@/app/_actions/items";
import { linkItems, unlinkItems } from "@/app/_actions/links";
import { listAllTags, setItemTags } from "@/app/_actions/tags";
import { links, papers, projects } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

let P: { type: "paper"; id: string };
let R: { type: "project"; id: string };

beforeEach(async () => {
  await useFreshDb();
  vi.mocked(revalidatePath).mockClear();
  P = { type: "paper", id: (await papers.create({ title: "논문" })).id };
  R = { type: "project", id: (await projects.create({ title: "연구" })).id };
});

describe("linkItems / unlinkItems", () => {
  it("links, revalidates both detail pages and unlinks", async () => {
    expect(await linkItems(P, R)).toEqual({ ok: true, data: undefined });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual([
      `/papers/${P.id}`,
      `/projects/${R.id}`,
    ]);
    expect(await links.listConnected(P)).toHaveLength(1);
    expect(await unlinkItems(R, P)).toEqual({ ok: true, data: undefined });
    expect(await links.listConnected(P)).toEqual([]);
  });

  it("returns Korean errors instead of throwing", async () => {
    expect(await linkItems(P, P)).toEqual({
      ok: false,
      error: "자기 자신과는 연결할 수 없습니다.",
    });
    expect(await linkItems(P, { type: "thought", id: "seed-thought-404" })).toEqual({
      ok: false,
      error: "연결할 항목을 찾을 수 없습니다.",
    });
    for (const bad of [
      null,
      "x",
      { type: "note", id: "1" },
      { type: "paper", id: 3 },
      { type: "paper", id: " " },
    ]) {
      const res = await linkItems(bad, R);
      expect(res.ok).toBe(false);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("tags actions", () => {
  it("sets tags from an array or a comma separated string", async () => {
    expect(await setItemTags(P, ["NLP", " 요약 ", "nlp"])).toEqual({
      ok: true,
      data: ["NLP", "요약"],
    });
    expect(await setItemTags(R, "nlp, 방법론")).toEqual({ ok: true, data: ["NLP", "방법론"] });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/projects/${R.id}`);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/projects");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/tags");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/");
    expect(await listAllTags()).toEqual({
      ok: true,
      data: [
        { name: "NLP", count: 2 },
        { name: "방법론", count: 1 },
        { name: "요약", count: 1 },
      ],
    });
    expect((await setItemTags(P, [1, 2])).ok).toBe(false);
    expect((await setItemTags({ type: "paper" }, [])).ok).toBe(false);
    expect(await setItemTags(P, null)).toEqual({ ok: true, data: [] });
  });
});

describe("searchItemTitles", () => {
  it("searches titles and validates input", async () => {
    const res = await searchItemTitles("논", R);
    expect(res).toEqual({ ok: true, data: [{ ref: P, type: "paper", title: "논문" }] });
    expect((await searchItemTitles({ q: 1 })).ok).toBe(false);
    expect((await searchItemTitles("x".repeat(201))).ok).toBe(false);
    expect((await searchItemTitles("", { type: "bad", id: "1" })).ok).toBe(false);
  });
});
