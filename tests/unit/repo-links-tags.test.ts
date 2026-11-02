import { beforeEach, describe, expect, it } from "vitest";
import { itemTags, links as linksTable, tags as tagsTable } from "@/db/schema";
import { items, links, papers, projects, RepoError, tags, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

describe("links", () => {
  it("links both ways, ignores duplicates and rejects self links", async () => {
    const paper = await papers.create({ title: "논문" });
    const project = await projects.create({ title: "연구" });
    const P = { type: "paper" as const, id: paper.id };
    const R = { type: "project" as const, id: project.id };

    const first = await links.link(P, R);
    expect(await links.link(P, R)).toEqual(first);
    expect(await links.link(R, P)).toEqual(first);
    expect(await db.select().from(linksTable)).toHaveLength(1);

    expect(await links.listConnected(P)).toEqual([
      { ref: R, type: "project", title: "연구", archived: false },
    ]);
    expect(await links.listConnected(R)).toEqual([
      { ref: P, type: "paper", title: "논문", archived: false },
    ]);

    await expect(links.link(P, P)).rejects.toBeInstanceOf(RepoError);
    await expect(links.link(P, { type: "thought", id: "missing" })).rejects.toMatchObject({
      code: "not_found",
    });

    expect(await links.unlink(R, P)).toBe(true);
    expect(await links.listConnected(P)).toEqual([]);
    expect(await links.unlink(R, P)).toBe(false);
  });
});

describe("tags", () => {
  it("normalizes names and matches case-insensitively", async () => {
    const a = await thoughts.create({ title: "A", tags: ["NLP", " #방법론 ", "nlp", ""] });
    expect(a.tags).toEqual(["NLP", "방법론"]);
    const b = await thoughts.create({ title: "B" });
    expect(await tags.setTags({ type: "thought", id: b.id }, ["nlp", "Survey"])).toEqual([
      "NLP",
      "Survey",
    ]);
    expect(await tags.getTags({ type: "thought", id: b.id })).toEqual(["NLP", "Survey"]);
    expect(await tags.listAll()).toEqual([
      { name: "NLP", count: 2 },
      { name: "Survey", count: 1 },
      { name: "방법론", count: 1 },
    ]);
    expect((await thoughts.list({ tag: "survey" })).map((t) => t.title)).toEqual(["B"]);
  });

  it("treats decomposed (NFD) and composed (NFC) Hangul as the same tag", async () => {
    const nfd = "방법론".normalize("NFD");
    const a = await thoughts.create({ title: "A", tags: [nfd] });
    expect(a.tags).toEqual(["방법론"]);
    const b = await thoughts.create({ title: "B", tags: ["방법론"] });
    expect(b.tags).toEqual(["방법론"]);
    expect(await tags.listAll()).toEqual([{ name: "방법론", count: 2 }]);
    expect(await thoughts.list({ tag: nfd })).toHaveLength(2);
  });

  it("drops unused tags when replaced", async () => {
    const a = await thoughts.create({ title: "A", tags: ["old"] });
    await thoughts.update(a.id, { tags: ["new"] });
    expect((await db.select().from(tagsTable)).map((t) => t.name)).toEqual(["new"]);
  });
});

describe("delete cleanup", () => {
  it("removing an item removes its links and tags; papers return the pdf path", async () => {
    const paper = await papers.create({ title: "논문", tags: ["only-paper", "shared"] });
    const thought = await thoughts.create({ title: "생각", tags: ["shared"] });
    const P = { type: "paper" as const, id: paper.id };
    const T = { type: "thought" as const, id: thought.id };
    await links.link(T, P);
    await papers.setPdf(paper.id, `data/pdfs/${paper.id}.pdf`, 10);

    expect(await papers.remove(paper.id)).toEqual({
      removed: true,
      pdfPath: `data/pdfs/${paper.id}.pdf`,
    });
    expect(await db.select().from(linksTable)).toEqual([]);
    expect(await db.select().from(itemTags)).toHaveLength(1);
    expect(await tags.listAll()).toEqual([{ name: "shared", count: 1 }]);
    expect(await links.listConnected(T)).toEqual([]);
    expect(await papers.remove(paper.id)).toEqual({ removed: false, pdfPath: null });
  });
});

describe("items.searchTitles", () => {
  it("searches titles across types, prefix first, honoring exclusion", async () => {
    const p = await papers.create({ title: "Attention 메커니즘" });
    await projects.create({ title: "어텐션 없는 연구" });
    await thoughts.create({ title: "Self-attention 질문" });
    await thoughts.create({ title: "관계없음" });

    const hits = await items.searchTitles("attention");
    expect(hits.map((h) => h.title)).toEqual(["Attention 메커니즘", "Self-attention 질문"]);
    const excluded = await items.searchTitles("attention", { type: "paper", id: p.id });
    expect(excluded.map((h) => h.title)).toEqual(["Self-attention 질문"]);
    expect(await items.searchTitles("100%")).toEqual([]);
    expect(await items.searchTitles("", undefined, 2)).toHaveLength(2);
  });
});
