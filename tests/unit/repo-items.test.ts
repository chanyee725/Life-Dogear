import { beforeEach, describe, expect, it } from "vitest";
import { papers, projects, RepoError, seminars, thoughts } from "@/lib/repo";
import { PAPER_TEMPLATE, PROJECT_TEMPLATE, SEMINAR_TEMPLATE } from "@/lib/templates";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

describe("projects", () => {
  it("creates with defaults and the project template", async () => {
    const p = await projects.create({ title: "  첫 연구  " });
    expect(p).toMatchObject({ title: "첫 연구", stage: "exploring", body: PROJECT_TEMPLATE });
    expect(p.tags).toEqual([]);
    expect(await projects.get(p.id)).toEqual(p);
  });

  it("updates fields and rejects invalid input", async () => {
    const p = await projects.create({ title: "연구" });
    const u = await projects.update(p.id, { stage: "drafting", dueDate: "2026-12-01" });
    expect(u).toMatchObject({ stage: "drafting", dueDate: "2026-12-01", title: "연구" });
    await expect(projects.update(p.id, { title: " " })).rejects.toBeInstanceOf(RepoError);
    await expect(projects.update(p.id, { dueDate: "12/01" })).rejects.toBeInstanceOf(RepoError);
    await expect(projects.create({ title: "x", stage: "nope" as never })).rejects.toBeInstanceOf(
      RepoError,
    );
    expect(await projects.update("missing", { title: "x" })).toBeNull();
  });

  it("filters by stage and tag, groups by stage without submitted", async () => {
    await projects.create({ title: "A", stage: "drafting", dueDate: "2026-12-10", tags: ["NLP"] });
    await projects.create({ title: "B", stage: "drafting", dueDate: "2026-11-10" });
    await projects.create({ title: "C", stage: "submitted" });
    expect((await projects.list({ stage: "drafting" })).map((p) => p.title).sort()).toEqual([
      "A",
      "B",
    ]);
    expect((await projects.list({ tag: "nlp" })).map((p) => p.title)).toEqual(["A"]);

    const columns = await projects.listByStage();
    expect(columns.map((c) => c.stage)).not.toContain("submitted");
    expect(columns.find((c) => c.stage === "drafting")!.items.map((p) => p.title)).toEqual([
      "B",
      "A",
    ]);
    const all = await projects.listByStage({ includeSubmitted: true });
    expect(all.at(-1)).toMatchObject({ stage: "submitted" });
    expect(all.at(-1)!.items).toHaveLength(1);
  });
});

describe("papers", () => {
  it("stores authors as a list and uses the paper template", async () => {
    const p = await papers.create({
      title: "논문",
      authors: [" 김가명 ", "", "Lee Fake"],
      year: 2024,
    });
    expect(p).toMatchObject({
      authors: ["김가명", "Lee Fake"],
      year: 2024,
      readStatus: "to_read",
      importance: "reference",
      body: PAPER_TEMPLATE,
      pdfPath: null,
    });
    await expect(papers.update(p.id, { year: 20 })).rejects.toBeInstanceOf(RepoError);
  });

  it("filters by status and importance", async () => {
    await papers.create({ title: "A", readStatus: "done", importance: "core" });
    await papers.create({ title: "B", readStatus: "done" });
    await papers.create({ title: "C" });
    expect((await papers.list({ status: "done", importance: "core" })).map((p) => p.title)).toEqual(
      ["A"],
    );
    expect(await papers.list({ sort: "title" })).toHaveLength(3);
  });
});

describe("seminars and thoughts", () => {
  it("seminar CRUD with template and date order", async () => {
    const a = await seminars.create({ title: "A", date: "2026-10-01", kind: "lecture" });
    await seminars.create({ title: "B", date: "2026-10-20" });
    await seminars.create({ title: "C" });
    expect(a.body).toBe(SEMINAR_TEMPLATE);
    expect((await seminars.list()).map((s) => s.title)).toEqual(["B", "A", "C"]);
    expect((await seminars.list({ kind: "lecture" })).map((s) => s.title)).toEqual(["A"]);
    expect(await seminars.listRecent(2)).toHaveLength(2);
    expect(await seminars.remove(a.id)).toBe(true);
    expect(await seminars.get(a.id)).toBeNull();
    expect(await seminars.remove(a.id)).toBe(false);
  });

  it("thought CRUD with defaults", async () => {
    const t = await thoughts.create({ title: "빠른 메모" });
    expect(t).toMatchObject({ kind: "memo", maturity: "seed", body: "" });
    const u = await thoughts.update(t.id, { maturity: "growing", body: "내용" });
    expect(u).toMatchObject({ maturity: "growing", body: "내용" });
    expect(u!.updatedAt >= t.updatedAt).toBe(true);
    expect((await thoughts.list({ maturity: "growing" })).map((x) => x.id)).toEqual([t.id]);
    expect(await thoughts.remove(t.id)).toBe(true);
    expect(await thoughts.list()).toEqual([]);
  });
});
