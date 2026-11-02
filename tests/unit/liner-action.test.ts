import { beforeAll, describe, expect, it, vi } from "vitest";
import { addLinerMemo } from "@/app/_actions/liner";
import { papers } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const MISSING = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

beforeAll(async () => {
  await useFreshDb();
});

describe("addLinerMemo", () => {
  it("appends to the paper body's Liner section and returns the new body", async () => {
    const { id } = await papers.create({ title: "라이너 메모 테스트" });
    const result = await addLinerMemo(id, {
      kind: "summary",
      text: "핵심 요약",
      sourceUrl: "https://liner.com/x",
    });
    expect(result.ok).toBe(true);
    const saved = await papers.get(id);
    expect(result.ok && result.data.body).toBe(saved?.body);
    expect(saved?.body).toMatch(
      /## 라이너 스콜라 메모\n\n### 요약 · \d{4}-\d{2}-\d{2}\n\n> 핵심 요약\n\n출처: \[라이너\]\(https:\/\/liner\.com\/x\)\n$/,
    );
    // The rest of the template is untouched.
    expect(saved?.body.startsWith("## 왜 읽나")).toBe(true);
  });

  it("rejects invalid input and unknown papers with Korean messages", async () => {
    const { id } = await papers.create({ title: "검증" });
    expect(await addLinerMemo(id, { kind: "answer", text: " " })).toEqual({
      ok: false,
      error: "붙여넣을 내용을 입력해 주세요.",
    });
    expect(await addLinerMemo(id, { kind: "x", text: "a" })).toMatchObject({ ok: false });
    expect(await addLinerMemo(id, null)).toMatchObject({ ok: false });
    expect(
      await addLinerMemo(id, { kind: "answer", text: "a", sourceUrl: "javascript:1" }),
    ).toMatchObject({ ok: false });
    expect(await addLinerMemo("../etc", { kind: "answer", text: "a" })).toMatchObject({
      ok: false,
    });
    expect(await addLinerMemo(MISSING, { kind: "answer", text: "a" })).toEqual({
      ok: false,
      error: "논문을 찾을 수 없습니다.",
    });
  });
});
