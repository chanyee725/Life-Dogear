import type { Client } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectTopics,
  findTopic,
  loadResources,
  mergeResources,
  parseTopicParam,
  resourcesHref,
} from "@/app/resources/resource-data";
import { archive, papers, projects, seminars, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

describe("parseTopicParam / findTopic / resourcesHref", () => {
  it("takes the first non-empty string, NFC-normalised", () => {
    expect(parseTopicParam(" 통계 ")).toBe("통계");
    expect(parseTopicParam(["방법론", "x"])).toBe("방법론");
    expect(parseTopicParam("  ")).toBeNull();
    expect(parseTopicParam(undefined)).toBeNull();
    expect(parseTopicParam("가".repeat(101))).toBeNull();
    expect(parseTopicParam("가")).toBe("가");
  });

  it("matches topics case-insensitively", () => {
    const topics = [{ name: "NLP", count: 2 }];
    expect(findTopic(topics, "nlp")).toEqual({ name: "NLP", count: 2 });
    expect(findTopic(topics, "cv")).toBeNull();
  });

  it("encodes the topic in the link", () => {
    expect(resourcesHref()).toBe("/resources");
    expect(resourcesHref("질적 연구")).toBe(
      "/resources?topic=%EC%A7%88%EC%A0%81%20%EC%97%B0%EA%B5%AC",
    );
  });
});

describe("collectTopics", () => {
  it("counts each item once per topic and sorts by name", () => {
    expect(
      collectTopics([{ tags: ["통계", "설계"] }, { tags: ["통계", "통계"] }, { tags: [] }]),
    ).toEqual([
      { name: "설계", count: 1 },
      { name: "통계", count: 2 },
    ]);
  });
});

describe("mergeResources", () => {
  it("mixes the three kinds newest first with kind-specific meta", () => {
    const items = mergeResources(
      [
        {
          id: "p1",
          title: "논문",
          authors: ["김가명", "이나명", "박다명"],
          year: 2024,
          readStatus: "reading",
          updatedAt: "2026-11-02T00:00:00.000Z",
        },
      ],
      [
        {
          id: "s1",
          title: "세미나",
          date: "2026-10-30",
          speaker: "한가명",
          kind: "lecture",
          updatedAt: "2026-11-03T00:00:00.000Z",
        },
      ],
      [{ id: "t1", title: "생각", kind: "question", updatedAt: "2026-11-01T00:00:00.000Z" }],
    );
    expect(items.map((i) => [i.type, i.href, i.meta])).toEqual([
      ["seminar", "/seminars/s1", "2026-10-30 · 한가명 · 강의"],
      ["paper", "/papers/p1", "김가명 외 2명 · 2024"],
      ["thought", "/thoughts/t1", "질문"],
    ]);
    expect(items[1]!.status).toEqual({ label: "읽는 중", tone: "blue" });
  });

  it("breaks ties by kind, then title", () => {
    const t = "2026-11-01T00:00:00.000Z";
    const items = mergeResources(
      [],
      [{ id: "s", title: "나", date: null, speaker: "", kind: "seminar", updatedAt: t }],
      [
        { id: "b", title: "나", kind: "memo", updatedAt: t },
        { id: "a", title: "가", kind: "memo", updatedAt: t },
      ],
    );
    expect(items.map((i) => i.id)).toEqual(["s", "a", "b"]);
    expect(items[0]!.meta).toBeUndefined();
  });
});

describe("loadResources", () => {
  let db: Awaited<ReturnType<typeof useFreshDb>>;
  beforeEach(async () => {
    db = await useFreshDb();
  });

  it("lists topics only when none is chosen", async () => {
    await papers.create({ title: "논문", tags: ["통계"] });
    const data = await loadResources(null);
    expect(data.topics.map((t) => t.name)).toEqual(["통계"]);
    expect(data).toMatchObject({ topic: null, unknownTopic: false, items: [] });
  });

  it("collects the topic's papers, seminars and thoughts, without archived items or projects", async () => {
    const p = await papers.create({ title: "논문 A", tags: ["통계"] });
    await seminars.create({ title: "세미나 B", tags: ["통계"] });
    await thoughts.create({ title: "생각 C", tags: ["통계"] });
    const gone = await thoughts.create({ title: "보관한 생각", tags: ["통계"] });
    await archive.archive({ type: "thought", id: gone.id });
    await projects.create({ title: "프로젝트", tags: ["통계"] });
    await papers.create({ title: "다른 주제", tags: ["설계"] });

    const data = await loadResources("통계");
    expect(data.topic).toBe("통계");
    expect(data.items.map((i) => i.title).sort()).toEqual(["논문 A", "생각 C", "세미나 B"]);
    expect(data.items.find((i) => i.id === p.id)?.type).toBe("paper");
  });

  it("matches the topic case-insensitively and reports unknown topics", async () => {
    await papers.create({ title: "논문", tags: ["NLP"] });
    expect((await loadResources("nlp")).topic).toBe("NLP");
    expect(await loadResources("없는 주제")).toMatchObject({
      topic: null,
      unknownTopic: true,
      items: [],
    });
  });

  it("offers only topics used by non-archived papers, seminars or thoughts", async () => {
    await papers.create({ title: "논문", tags: ["통계"] });
    await projects.create({ title: "프로젝트", tags: ["학위"] });
    const gone = await seminars.create({ title: "보관한 세미나", tags: ["옛 주제"] });
    await archive.archive({ type: "seminar", id: gone.id });

    const data = await loadResources(null);
    expect(data.topics).toEqual([{ name: "통계", count: 1 }]);
    expect(await loadResources("학위")).toMatchObject({ topic: null, unknownTopic: true });
    expect(await loadResources("옛 주제")).toMatchObject({ topic: null, unknownTopic: true });
  });

  it("uses a fixed number of queries regardless of how many items there are", async () => {
    // drizzle keeps the libSQL client on `$client` (not in the `Db` type).
    const client = (db as unknown as { $client: Client }).$client;
    const execute = vi.spyOn(client, "execute");
    const count = async (topic: string | null = "통계") => {
      execute.mockClear();
      await loadResources(topic);
      return execute.mock.calls.length;
    };
    await papers.create({ title: "논문 0", tags: ["통계"] });
    await seminars.create({ title: "세미나 0", tags: ["통계"] });
    await thoughts.create({ title: "생각 0", tags: ["통계"] });
    const small = await count();
    expect(small).toBeLessThanOrEqual(6); // 3 × (list + tags)
    expect(await count(null)).toBe(small); // choosing a topic adds no queries
    for (let i = 1; i < 20; i++) {
      await papers.create({ title: `논문 ${i}`, tags: ["통계"] });
      await seminars.create({ title: `세미나 ${i}`, tags: ["통계"] });
      await thoughts.create({ title: `생각 ${i}`, tags: ["통계"] });
    }
    expect(await count()).toBe(small);
  });
});
