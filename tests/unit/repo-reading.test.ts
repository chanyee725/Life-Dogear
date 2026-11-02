import { beforeEach, describe, expect, it } from "vitest";
import { papers } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

describe("reading progress", () => {
  it("saveProgress moves to_read to reading and stamps lastReadAt without editing updatedAt", async () => {
    const p = await papers.create({ title: "논문" });
    await papers.setPdf(p.id, `data/pdfs/${p.id}.pdf`, 12);
    const before = (await papers.get(p.id))!;

    expect(await papers.saveProgress(p.id, { page: 4, scroll: 0.25, totalPages: 12 })).toBe(true);
    const after = (await papers.get(p.id))!;
    expect(after).toMatchObject({
      readStatus: "reading",
      lastPage: 4,
      lastScroll: 0.25,
      totalPages: 12,
    });
    expect(after.lastReadAt).not.toBeNull();
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it("clamps values and keeps done papers done", async () => {
    const p = await papers.create({ title: "논문", readStatus: "done" });
    await papers.saveProgress(p.id, { page: 99, scroll: 1.7, totalPages: 10 });
    expect(await papers.get(p.id)).toMatchObject({
      readStatus: "done",
      lastPage: 10,
      lastScroll: 1,
    });
    await papers.saveProgress(p.id, { page: -3, scroll: Number.NaN });
    expect(await papers.get(p.id)).toMatchObject({ lastPage: 1, lastScroll: 0, totalPages: 10 });
    expect(await papers.saveProgress("missing", { page: 1, scroll: 0 })).toBe(false);
  });

  it("clamps to the stored page count when totalPages is omitted", async () => {
    const p = await papers.create({ title: "논문" });
    await papers.saveProgress(p.id, { page: 99, scroll: 0 });
    expect(await papers.get(p.id)).toMatchObject({ lastPage: 99, totalPages: null });
    await papers.setPdf(p.id, "data/pdfs/x.pdf", 10);
    await papers.saveProgress(p.id, { page: 99, scroll: 0 });
    expect(await papers.get(p.id)).toMatchObject({ lastPage: 10, totalPages: 10 });
  });

  it("setPdf replaces the file, resets position and returns the previous path", async () => {
    const p = await papers.create({ title: "논문" });
    expect(await papers.setPdf(p.id, "data/pdfs/a.pdf", 5)).toEqual({ previousPdfPath: null });
    await papers.saveProgress(p.id, { page: 3, scroll: 0.5 });
    expect(await papers.setPdf(p.id, "data/pdfs/b.pdf", 8)).toEqual({
      previousPdfPath: "data/pdfs/a.pdf",
    });
    expect(await papers.get(p.id)).toMatchObject({
      pdfPath: "data/pdfs/b.pdf",
      totalPages: 8,
      lastPage: null,
    });
    await papers.setPdf(p.id, null);
    expect(await papers.get(p.id)).toMatchObject({ pdfPath: null, totalPages: null });
    expect(await papers.setPdf("missing", null)).toBeUndefined();
  });

  it("listContinueReading returns reading papers, most recent first", async () => {
    const a = await papers.create({ title: "A" });
    const b = await papers.create({ title: "B" });
    await papers.create({ title: "C" });
    await papers.saveProgress(a.id, { page: 1, scroll: 0 });
    await new Promise((r) => setTimeout(r, 5));
    await papers.saveProgress(b.id, { page: 2, scroll: 0 });
    expect((await papers.listContinueReading()).map((p) => p.title)).toEqual(["B", "A"]);
    expect(await papers.listContinueReading(1)).toHaveLength(1);
  });
});
