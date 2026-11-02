import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
import { createQuickThought } from "@/app/_actions/quick-thought";
import { thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
  vi.mocked(revalidatePath).mockClear();
});

describe("createQuickThought", () => {
  it("saves a memo/seed thought from FormData and revalidates home and list", async () => {
    const form = new FormData();
    form.set("title", "  오늘 떠오른 생각  ");
    const res = await createQuickThought(form);
    expect(res.ok).toBe(true);
    const id = res.ok ? res.data.id : "";
    expect(await thoughts.get(id)).toMatchObject({
      title: "오늘 떠오른 생각",
      kind: "memo",
      maturity: "seed",
      body: "",
    });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/", "/thoughts", "/"]);
    expect(vi.mocked(revalidatePath)).toHaveBeenLastCalledWith("/", "layout");
  });

  it("uses the first line as title and the rest as body", async () => {
    const res = await createQuickThought("제목 줄\n둘째 줄\n셋째 줄");
    const t = await thoughts.get(res.ok ? res.data.id : "");
    expect(t).toMatchObject({ title: "제목 줄", body: "둘째 줄\n셋째 줄" });
  });

  it("shortens very long titles and keeps the full text in the body", async () => {
    const long = "가".repeat(250);
    const res = await createQuickThought(long);
    const t = (await thoughts.get(res.ok ? res.data.id : ""))!;
    expect(t.title).toHaveLength(201);
    expect(t.body).toBe(long);
  });

  it("rejects empty input and files", async () => {
    expect(await createQuickThought("   ")).toEqual({ ok: false, error: "내용을 입력하세요." });
    expect((await createQuickThought(new FormData())).ok).toBe(false);
    const form = new FormData();
    form.set("title", new Blob(["x"]), "x.txt");
    expect((await createQuickThought(form)).ok).toBe(false);
    expect(await thoughts.list()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
