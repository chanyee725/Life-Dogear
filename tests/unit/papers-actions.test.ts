import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPaper, deletePaper, updatePaper } from "@/app/papers/actions";
import { papers } from "@/lib/repo";
import { pdfExists, writePdf } from "@/lib/storage/pdf";
import { useFreshDb } from "./repo-helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const cwd = process.cwd();
let root = "";

beforeAll(async () => {
  await useFreshDb();
  root = await mkdtemp(join(tmpdir(), "rb-actions-"));
  process.chdir(root);
});

afterAll(async () => {
  process.chdir(cwd);
  await rm(root, { recursive: true, force: true });
});

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("paper actions", () => {
  it("creates a paper from the form and redirects", async () => {
    const data = form([
      ["title", "  주의 집중 연구  "],
      ["authors", "Kim, J."],
      ["authors", ""],
      ["authors", "Lee, S."],
      ["year", "2024"],
      ["readStatus", "to_read"],
      ["importance", "core"],
      ["tags", "NLP"],
      ["body", "## 왜 읽나"],
    ]);
    const error = await createPaper(null, data).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const id = (error as Error).message.replace("REDIRECT:/papers/", "");
    const paper = await papers.get(id);
    expect(paper).toMatchObject({
      title: "주의 집중 연구",
      authors: ["Kim, J.", "Lee, S."],
      year: 2024,
      importance: "core",
      tags: ["NLP"],
      body: "## 왜 읽나",
    });
  });

  it("returns a Korean error for invalid input", async () => {
    expect(await createPaper(null, form([["title", " "]]))).toMatchObject({ ok: false });
    expect(
      await createPaper(
        null,
        form([
          ["title", "x"],
          ["year", "abc"],
        ]),
      ),
    ).toEqual({
      ok: false,
      error: "연도 값이 올바르지 않습니다.",
    });
  });

  it("updates only the given fields", async () => {
    const { id } = await papers.create({ title: "원래 제목", venue: "ACL" });
    expect(await updatePaper(id, { summary: "요약", readStatus: "done" })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await papers.get(id)).toMatchObject({
      title: "원래 제목",
      venue: "ACL",
      summary: "요약",
      readStatus: "done",
    });
    expect(await updatePaper(id, { readStatus: "nope" })).toMatchObject({ ok: false });
    expect(await updatePaper(id, "x")).toMatchObject({ ok: false });
    expect(await updatePaper("../x", { title: "y" })).toMatchObject({ ok: false });
  });

  it("deletes the paper and its PDF", async () => {
    const { id } = await papers.create({ title: "삭제" });
    await papers.setPdf(id, await writePdf(id, new TextEncoder().encode("%PDF-1.7")));
    expect(await pdfExists(id)).toBe(true);
    expect(await deletePaper(id)).toMatchObject({ ok: true });
    expect(await papers.get(id)).toBeNull();
    expect(await pdfExists(id)).toBe(false);
    expect(await deletePaper(id)).toMatchObject({ ok: false });
  });
});
