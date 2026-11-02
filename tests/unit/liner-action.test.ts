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
      /## 라이너 스콜라 메모\n\n### 요약 · \d{4}-\d{2}-\d{2}\n\n> 핵심 요약\n\n출처: \[liner\.com\]\(https:\/\/liner\.com\/x\)\n$/,
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

  it("keeps both memos when two are saved at the same time", async () => {
    const { id } = await papers.create({ title: "동시 저장" });
    const results = await Promise.all([
      addLinerMemo(id, { kind: "answer", text: "첫 번째 답변" }),
      addLinerMemo(id, { kind: "highlight", text: "두 번째 하이라이트" }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    const body = (await papers.get(id))!.body;
    expect(body).toContain("> 첫 번째 답변");
    expect(body).toContain("> 두 번째 하이라이트");
    expect(body.match(/## 라이너 스콜라 메모/g)).toHaveLength(1);
  });

  it("rejects a memo that would make the body too long, leaving it unchanged", async () => {
    const { id } = await papers.create({ title: "긴 본문" });
    await papers.update(id, { body: "가".repeat(499_990) });
    expect(await addLinerMemo(id, { kind: "summary", text: "넘치는 요약" })).toEqual({
      ok: false,
      error: "본문이 너무 길어 저장할 수 없습니다.",
    });
    expect((await papers.get(id))!.body).toHaveLength(499_990);
  });
});
