import { beforeEach, describe, expect, it } from "vitest";
import { graphLayout, itemStars, links as linksTable } from "@/db/schema";
import { archive, areas, goals, items, links, notes, papers, projects, tags } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

describe("notes repo", () => {
  it("creates, reads, updates and lists with filters", async () => {
    const area = await areas.create({ title: "공부" });
    const n = await notes.create({
      title: "  데이터 중심 앱 설계 ",
      body: "복제와 파티셔닝",
      sourceKind: "book",
      sourceTitle: " DDIA ",
      sourceUrl: " https://example.com/ddia ",
      areaId: area.id,
      tags: ["분산"],
    });
    expect(n).toMatchObject({
      title: "데이터 중심 앱 설계",
      sourceKind: "book",
      sourceTitle: "DDIA",
      sourceUrl: "https://example.com/ddia",
      areaId: area.id,
      tags: ["분산"],
      archivedAt: null,
    });
    const lecture = await notes.create({ title: "강의 노트", sourceKind: "lecture" });
    expect(lecture).toMatchObject({ body: "", sourceTitle: null, sourceUrl: null, areaId: null });

    expect((await notes.list({ sourceKind: "book" })).map((x) => x.id)).toEqual([n.id]);
    expect((await notes.list({ tag: "분산" })).map((x) => x.id)).toEqual([n.id]);
    expect((await notes.list({ areaId: area.id })).map((x) => x.id)).toEqual([n.id]);
    expect((await notes.list({ sort: "title" })).map((x) => x.title)).toEqual([
      "강의 노트",
      "데이터 중심 앱 설계",
    ]);

    const u = await notes.update(n.id, { sourceKind: "", sourceUrl: "", areaId: null });
    expect(u).toMatchObject({ sourceKind: null, sourceUrl: null, areaId: null, title: n.title });
    expect(await notes.update("missing", { title: "x" })).toBeNull();
  });

  it("rejects non-http(s) source links, bad kinds and unknown or archived areas", async () => {
    await expect(notes.create({ title: "a", sourceUrl: "javascript:alert(1)" })).rejects.toThrow(
      /http\(s\)/,
    );
    await expect(notes.create({ title: "a", sourceUrl: "not a url" })).rejects.toThrow();
    await expect(notes.create({ title: "a", sourceKind: "podcast" as never })).rejects.toThrow();
    await expect(notes.create({ title: "a", areaId: "nope" })).rejects.toThrow(/영역/);
    const area = await areas.create({ title: "옛 영역" });
    await archive.archive({ type: "area", id: area.id });
    await expect(notes.create({ title: "a", areaId: area.id })).rejects.toThrow(/영역/);
    await expect(notes.create({ title: "  " })).rejects.toThrow(/제목/);
    expect(await notes.list({ includeArchived: true })).toEqual([]);
  });

  it("is an item type: title search, wikilinks, archive", async () => {
    const paper = await papers.create({ title: "Attention" });
    const n = await notes.create({ title: "트랜스포머 정리", body: "[[Attention]] 요약" });
    const N = { type: "note" as const, id: n.id };
    expect((await items.searchTitles("트랜스")).map((s) => s.ref)).toEqual([N]);
    expect(await links.listConnected({ type: "paper", id: paper.id })).toEqual([
      { ref: N, type: "note", title: "트랜스포머 정리", archived: false },
    ]);
    // A note is a [[title]] target too.
    await papers.update(paper.id, { body: "[[트랜스포머 정리]]" });
    expect((await items.resolveTitles(["트랜스포머 정리"])).get("트랜스포머 정리")?.ref).toEqual(N);

    await notes.update(n.id, { body: "없음" });
    expect((await db.select().from(linksTable)).map((l) => l.sourceType)).toEqual(["paper"]);

    await archive.archive(N);
    expect(await notes.list()).toEqual([]);
    expect((await notes.list({ onlyArchived: true })).map((x) => x.id)).toEqual([n.id]);
    expect((await archive.listArchived()).map((a) => a.ref)).toEqual([N]);
  });

  it("removes links, tags, stars and pinned position on delete", async () => {
    const paper = await papers.create({ title: "P" });
    const n = await notes.create({ title: "N", tags: ["t"] });
    const N = { type: "note" as const, id: n.id };
    await links.link(N, { type: "paper", id: paper.id });
    const t = "2026-11-04T00:00:00.000Z";
    await db.insert(itemStars).values({ itemType: "note", itemId: n.id, createdAt: t });
    await db
      .insert(graphLayout)
      .values({ nodeType: "note", nodeId: n.id, x: 1, y: 2, updatedAt: t });

    expect(await notes.remove(n.id)).toBe(true);
    expect(await notes.remove(n.id)).toBe(false);
    expect(await db.select().from(linksTable)).toEqual([]);
    expect(await db.select().from(itemStars)).toEqual([]);
    expect(await db.select().from(graphLayout)).toEqual([]);
    expect((await tags.getTagsFor("note", [n.id])).get(n.id)).toEqual([]);
    expect(await tags.listAll()).toEqual([]);
  });
});

describe("notes.listForItem / create linkTo", () => {
  it("lists linked notes (and an area's own notes) once, without archived ones", async () => {
    const area = await areas.create({ title: "공부 영역" });
    const project = await projects.create({ title: "프로젝트 A" });
    const linked = await notes.create({
      title: "연결 노트",
      linkTo: { type: "project", id: project.id },
    });
    expect(await links.listConnected({ type: "project", id: project.id })).toMatchObject([
      { ref: { type: "note", id: linked.id } },
    ]);
    const owned = await notes.create({ title: "영역 노트", areaId: area.id });
    const both = await notes.create({
      title: "둘 다",
      areaId: area.id,
      linkTo: { type: "area", id: area.id },
    });
    const old = await notes.create({ title: "보관", linkTo: { type: "project", id: project.id } });
    await archive.archive({ type: "note", id: old.id });
    await notes.create({ title: "남" });

    const ids = async (ref: Parameters<typeof notes.listForItem>[0]) =>
      (await notes.listForItem(ref)).map((n) => n.id).sort();
    expect(await ids({ type: "project", id: project.id })).toEqual([linked.id]);
    expect(await ids({ type: "area", id: area.id })).toEqual([owned.id, both.id].sort());
    // A note linked the other way round (note → project, e.g. by [[…]] in its body) counts too.
    const fromBody = await notes.create({ title: "본문 링크", body: "[[프로젝트 A]]" });
    expect(await ids({ type: "project", id: project.id })).toEqual([linked.id, fromBody.id].sort());
    // Editing keeps the stored creation time.
    const edited = await notes.update(linked.id, { title: "연결 노트 2" });
    expect(edited?.createdAt).toBe(linked.createdAt);
    const goal = await goals.create({ title: "목표 G", horizon: "life" });
    expect(await notes.listForItem({ type: "goal", id: goal.id })).toEqual([]);
  });

  it("rolls back the note when the link target does not exist", async () => {
    await expect(
      notes.create({ title: "고아", linkTo: { type: "project", id: "seed-missing" } }),
    ).rejects.toThrow();
    expect(await notes.list()).toEqual([]);
  });
});
