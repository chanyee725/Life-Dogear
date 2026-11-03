import { beforeEach, describe, expect, it } from "vitest";
import { links as linksTable } from "@/db/schema";
import { archive, goals, items, links, papers, projects, thoughts } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;
beforeEach(async () => {
  db = await useFreshDb();
});

const rows = async () =>
  (await db.select().from(linksTable)).map((l) => ({
    from: `${l.sourceType}:${l.sourceId}`,
    to: `${l.targetType}:${l.targetId}`,
    via: l.via,
  }));

describe("resolveTitles", () => {
  it("matches case-insensitively and prefers live, recent items", async () => {
    const old = await papers.create({ title: "Attention" });
    await archive.archive({ type: "paper", id: old.id });
    const live = await thoughts.create({ title: "attention" });
    const r = await items.resolveTitles([" ATTENTION ", "없음"]);
    expect(r.get("attention")?.ref).toEqual({ type: "thought", id: live.id });
    expect(r.has("없음")).toBe(false);
  });
});

describe("syncBodyLinks", () => {
  it("adds body links on save and removes them when the [[…]] goes", async () => {
    const paper = await papers.create({ title: "논문 A" });
    const goal = await goals.create({ title: "목표 B", horizon: "life" });
    const t = await thoughts.create({
      title: "생각",
      body: "[[논문 A]] 와 [[목표 B]], [[없는 제목]]",
    });
    const T = `thought:${t.id}`;
    expect(await rows()).toEqual(
      expect.arrayContaining([
        { from: T, to: `paper:${paper.id}`, via: "body" },
        { from: T, to: `goal:${goal.id}`, via: "body" },
      ]),
    );
    expect(await rows()).toHaveLength(2);

    await thoughts.update(t.id, { body: "> [[논문 A]] 인용 안 \n`[[목표 B]]` 코드 안" });
    expect(await rows()).toEqual([]);
    // Fields other than the body leave links alone.
    await thoughts.update(t.id, { body: "[[논문 A]]" });
    await thoughts.update(t.id, { title: "생각 2" });
    expect(await rows()).toHaveLength(1);
    // Self links are ignored.
    await thoughts.update(t.id, { body: "[[생각 2]]" });
    expect(await rows()).toEqual([]);
  });

  it("never touches or duplicates a manual link, either direction", async () => {
    const paper = await papers.create({ title: "논문 A" });
    const t = await thoughts.create({ title: "생각" });
    const P = { type: "paper" as const, id: paper.id };
    const T = { type: "thought" as const, id: t.id };
    await links.link(P, T); // manual, created from the paper side

    await thoughts.update(t.id, { body: "[[논문 A]]" });
    expect(await rows()).toEqual([
      { from: `paper:${paper.id}`, to: `thought:${t.id}`, via: "manual" },
    ]);
    await thoughts.update(t.id, { body: "" });
    expect(await rows()).toEqual([
      { from: `paper:${paper.id}`, to: `thought:${t.id}`, via: "manual" },
    ]);

    // A manual link made over an existing body link promotes it; the body then can't remove it.
    const p2 = await projects.create({ title: "연구", body: "[[생각]]" });
    await links.link(T, { type: "project", id: p2.id });
    await projects.update(p2.id, { body: "" });
    expect((await rows()).filter((r) => r.from === `project:${p2.id}`)).toEqual([
      { from: `project:${p2.id}`, to: `thought:${t.id}`, via: "manual" },
    ]);
  });

  it("keeps a body link the other side's body still makes", async () => {
    const a = await thoughts.create({ title: "A" });
    const b = await thoughts.create({ title: "B", body: "[[A]]" });
    await thoughts.update(a.id, { body: "[[B]]" }); // pair already linked (B → A)
    expect(await rows()).toEqual([{ from: `thought:${b.id}`, to: `thought:${a.id}`, via: "body" }]);
    await thoughts.update(b.id, { body: "" }); // A's body still links B: row turns around
    expect(await rows()).toEqual([{ from: `thought:${a.id}`, to: `thought:${b.id}`, via: "body" }]);
    await thoughts.update(a.id, { body: "" });
    expect(await rows()).toEqual([]);
  });
});

describe("title rename", () => {
  it("counts and rewrites [[old]] in linked bodies only", async () => {
    const target = await papers.create({ title: "옛 제목" });
    const t = await thoughts.create({ title: "생각", body: "[[옛 제목]] 그리고 `[[옛 제목]]`" });
    const other = await thoughts.create({ title: "무관", body: "[[옛 제목]]" });
    // `other` is linked too (its body resolves the same title).
    const unrelated = await thoughts.create({ title: "따로", body: "옛 제목 언급만" });
    const P = { type: "paper" as const, id: target.id };

    await papers.update(target.id, { title: "새 제목" });
    expect(await links.countTitleMentions(P, "옛 제목")).toBe(2);
    const changed = await links.renameTitleMentions(P, "옛 제목", "새 제목");
    expect(changed.map((r) => r.id).sort()).toEqual([t.id, other.id].sort());
    expect((await thoughts.get(t.id))?.body).toBe("[[새 제목]] 그리고 `[[옛 제목]]`");
    expect((await thoughts.get(unrelated.id))?.body).toBe("옛 제목 언급만");
    expect(await links.countTitleMentions(P, "옛 제목")).toBe(0);
  });
});

describe("review follow-ups", () => {
  it("resolves non-ASCII case and extra spaces", async () => {
    const p = await papers.create({ title: "Étude Über" });
    const t = await thoughts.create({ title: "공백  두 칸" });
    const r = await items.resolveTitles(["étude über", "공백 두 칸", "  ÉTUDE   ÜBER "]);
    expect(r.get("étude über")?.ref).toEqual({ type: "paper", id: p.id });
    expect(r.get("공백 두 칸")?.ref).toEqual({ type: "thought", id: t.id });
    await thoughts.create({ title: "본문", body: "[[ÉTUDE ÜBER]]" });
    expect(await links.listConnected({ type: "paper", id: p.id })).toHaveLength(1);
  });

  it("syncs [[…]] in review bodies", async () => {
    const g = await goals.create({ title: "1저자 논문", horizon: "life" });
    const { review } = await reviews.open("week", "2026-W45");
    await reviews.update(review.id, { body: "이번 주는 [[1저자 논문]]" });
    expect(await rows()).toEqual([
      { from: `review:${review.id}`, to: `goal:${g.id}`, via: "body" },
    ]);
    await reviews.update(review.id, { body: "" });
    expect(await rows()).toEqual([]);
  });

  it("re-syncs rewritten bodies after a rename", async () => {
    const a = await papers.create({ title: "A" });
    const b = await papers.create({ title: "B" });
    const t = await thoughts.create({ title: "생각", body: "[[A]]" });
    await papers.update(a.id, { title: "A2" });
    await links.renameTitleMentions({ type: "paper", id: a.id }, "A", "A2");
    expect((await thoughts.get(t.id))?.body).toBe("[[A2]]");
    expect(await rows()).toEqual([{ from: `thought:${t.id}`, to: `paper:${a.id}`, via: "body" }]);
    // A rename to an existing other title moves the body link to what it now resolves to.
    await papers.remove(b.id);
    const c = await papers.create({ title: "C" });
    await papers.update(a.id, { title: "A3" });
    await links.renameTitleMentions({ type: "paper", id: a.id }, "A2", "C");
    expect(await rows()).toEqual([{ from: `thought:${t.id}`, to: `paper:${c.id}`, via: "body" }]);
  });

  it("ensureTitledThought finds or creates in one go", async () => {
    const src = await thoughts.create({ title: "출처", body: "[[새 것]]" });
    const S = { type: "thought" as const, id: src.id };
    const [x, y] = await Promise.all([
      links.ensureTitledThought("새 것", S),
      links.ensureTitledThought("새  것", S),
    ]);
    expect(x).toEqual(y);
    expect((await thoughts.list()).filter((t) => t.title === "새 것")).toHaveLength(1);
    expect(await links.listConnected(S)).toHaveLength(1);
  });
});
