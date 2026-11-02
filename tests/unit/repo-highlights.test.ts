import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createHighlight,
  createThoughtFromHighlight,
  deleteHighlight,
  updateHighlight,
} from "@/app/_actions/highlights";
import { links, papers, thoughts } from "@/lib/repo";
import * as highlights from "@/lib/repo/highlights";
import { useFreshDb } from "./repo-helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const MISSING = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const RECT = { x: 0.1, y: 0.2, w: 0.5, h: 0.02 };

let db: Awaited<ReturnType<typeof useFreshDb>>;

beforeAll(async () => {
  db = await useFreshDb();
});

describe("highlights repo", () => {
  it("creates, lists in reading order, updates and removes", async () => {
    const { id: paperId } = await papers.create({ title: "하이라이트 논문" });
    const lower = await highlights.create({
      paperId,
      page: 2,
      text: "아래쪽\n문장",
      rects: [{ ...RECT, y: 0.6 }],
    });
    const upper = await highlights.create({
      paperId,
      page: 2,
      text: "위쪽",
      color: "blue",
      note: " 메모 ",
      rects: [RECT],
    });
    const first = await highlights.create({ paperId, page: 1, text: "첫 쪽" });

    expect(lower).toMatchObject({ text: "아래쪽 문장", color: "yellow", note: "", page: 2 });
    expect(upper).toMatchObject({ color: "blue", note: "메모", rects: [RECT] });
    expect((await highlights.listByPaper(paperId)).map((h) => h.id)).toEqual([
      first.id,
      upper.id,
      lower.id,
    ]);

    expect(await highlights.update(upper.id, { note: "고친 메모", color: "rose" })).toMatchObject({
      note: "고친 메모",
      color: "rose",
    });
    expect(await highlights.update(MISSING, { note: "x" })).toBeNull();

    expect(await highlights.remove(first.id)).toBe(true);
    expect(await highlights.remove(first.id)).toBe(false);
    expect(await highlights.listByPaper(paperId)).toHaveLength(2);
  });

  it("validates input", async () => {
    const { id: paperId } = await papers.create({ title: "검증" });
    const bad = [
      { paperId: "nope", page: 1, text: "a" },
      { paperId, page: 0, text: "a" },
      { paperId, page: 1.5, text: "a" },
      { paperId, page: 1, text: "   " },
      { paperId, page: 1, text: "a".repeat(10_001) },
      { paperId, page: 1, text: "a", color: "purple" },
      { paperId, page: 1, text: "a", rects: [{ x: 2, y: 0, w: 1, h: 1 }] },
      { paperId, page: 1, text: "a", note: "n".repeat(10_001) },
    ];
    for (const input of bad) {
      await expect(highlights.create(input as highlights.HighlightInput)).rejects.toMatchObject({
        code: "invalid",
      });
    }
    await expect(highlights.create({ paperId: MISSING, page: 1, text: "a" })).rejects.toMatchObject(
      { code: "not_found" },
    );
  });

  it("is removed together with its paper", async () => {
    const { id: paperId } = await papers.create({ title: "삭제" });
    await highlights.create({ paperId, page: 1, text: "a" });
    await papers.remove(paperId);
    expect(await highlights.listByPaper(paperId)).toEqual([]);
  });
});

describe("createThought", () => {
  it("creates a memo/seed thought quoting the highlight, linked to the paper", async () => {
    const { id: paperId } = await papers.create({ title: "연결 논문" });
    const h = await highlights.create({ paperId, page: 7, text: "중요한 주장", note: "반론 가능" });

    const result = await highlights.createThought(h.id);
    expect(result).not.toBeNull();
    const thought = await thoughts.get(result!.thoughtId);
    expect(thought).toMatchObject({
      title: "중요한 주장",
      kind: "memo",
      maturity: "seed",
      body: "> 중요한 주장\n\n— 연결 논문, p. 7\n\n반론 가능\n",
    });
    expect(await links.listConnected({ type: "paper", id: paperId })).toEqual([
      {
        ref: { type: "thought", id: thought!.id },
        type: "thought",
        title: "중요한 주장",
        archived: false,
      },
    ]);
    expect(await highlights.createThought(MISSING)).toBeNull();
  });
});

describe("createThought rollback", () => {
  it("leaves no thought behind when the link cannot be written", async () => {
    const { id: paperId } = await papers.create({ title: "롤백 논문" });
    const h = await highlights.create({ paperId, page: 1, text: "롤백 확인용 문장" });
    const before = (await thoughts.list()).length;
    // Make the second insert of the transaction fail.
    await db.run(sql`ALTER TABLE links RENAME TO links_off`);
    try {
      await expect(highlights.createThought(h.id)).rejects.toBeTruthy();
    } finally {
      await db.run(sql`ALTER TABLE links_off RENAME TO links`);
    }
    expect(await thoughts.list()).toHaveLength(before);
    expect((await thoughts.list()).some((t) => t.title === "롤백 확인용 문장")).toBe(false);
  });
});

describe("note messages", () => {
  it("tells a wrong type apart from a note that is too long", async () => {
    const { id: paperId } = await papers.create({ title: "메모 문구" });
    await expect(
      highlights.create({ paperId, page: 1, text: "a", note: 5 as never }),
    ).rejects.toThrow("메모 값이 올바르지 않습니다.");
    await expect(
      highlights.create({ paperId, page: 1, text: "a", note: "n".repeat(10_001) }),
    ).rejects.toThrow("메모가 너무 깁니다.");
  });
});

describe("highlight actions", () => {
  it("round-trips through the server actions", async () => {
    const { id: paperId } = await papers.create({ title: "액션" });
    const created = await createHighlight({
      paperId,
      page: 1,
      text: "선택",
      color: "green",
      rects: [RECT],
    });
    expect(created).toMatchObject({ ok: true, data: { color: "green" } });
    const id = created.ok ? created.data.id : "";

    expect(await updateHighlight(id, { note: "메모" })).toMatchObject({
      ok: true,
      data: { note: "메모" },
    });
    const made = await createThoughtFromHighlight(id);
    expect(made.ok).toBe(true);
    expect(await deleteHighlight(id)).toEqual({ ok: true, data: undefined });
    expect(await deleteHighlight(id)).toEqual({
      ok: false,
      error: "하이라이트를 찾을 수 없습니다.",
    });
    expect(await createThoughtFromHighlight(id)).toMatchObject({ ok: false });
  });

  it("returns Korean errors for bad input", async () => {
    expect(await createHighlight(null)).toMatchObject({ ok: false });
    expect(await createHighlight({ paperId: MISSING, page: 1, text: "a" })).toEqual({
      ok: false,
      error: "논문을 찾을 수 없습니다.",
    });
    expect(await updateHighlight("x", {})).toMatchObject({ ok: false });
    expect(await updateHighlight(MISSING, { note: "a" })).toEqual({
      ok: false,
      error: "하이라이트를 찾을 수 없습니다.",
    });
  });
});
