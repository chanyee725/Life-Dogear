import { beforeEach, describe, expect, it } from "vitest";
import {
  archive,
  areas,
  items,
  links,
  papers,
  projects,
  RepoError,
  seminars,
  tags,
  thoughts,
} from "@/lib/repo";
import { deriveLifecycle } from "@/lib/repo/projects";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

const NOW = "2026-11-02T00:00:00.000Z";

describe("deriveLifecycle", () => {
  const base = {
    kind: "research",
    stage: "drafting",
    status: "active",
    completedAt: null,
  } as const;

  it("syncs research stage submitted with status done", () => {
    expect(deriveLifecycle(base, { stage: "submitted" }, NOW)).toMatchObject({
      status: "done",
      completedAt: NOW,
    });
    const done = { ...base, stage: "submitted", status: "done", completedAt: "t0" } as const;
    expect(deriveLifecycle(done, { stage: "revising" }, NOW)).toMatchObject({
      status: "active",
      completedAt: null,
    });
    expect(deriveLifecycle(done, { status: "on_hold" }, NOW)).toMatchObject({
      stage: "revising",
      status: "on_hold",
    });
    expect(deriveLifecycle(base, { status: "done" }, NOW)).toMatchObject({ stage: "submitted" });
    expect(deriveLifecycle(done, { title: "x" } as never, NOW).completedAt).toBe("t0");
    // stage wins over a conflicting status in the same patch
    expect(deriveLifecycle(base, { stage: "submitted", status: "active" }, NOW).status).toBe(
      "done",
    );
  });

  it("general projects only track status and completion", () => {
    const g = { ...base, kind: "general" } as const;
    expect(deriveLifecycle(g, { status: "done" }, NOW)).toMatchObject({
      stage: "drafting",
      completedAt: NOW,
    });
    expect(
      deriveLifecycle({ ...g, status: "done", completedAt: "t0" }, { status: "active" }, NOW),
    ).toMatchObject({ completedAt: null });
    expect(
      deriveLifecycle({ ...g, status: "done", completedAt: null }, { kind: "research" }, NOW),
    ).toMatchObject({ stage: "submitted", status: "done" });
  });
});

describe("projects 1.5", () => {
  it("creates research by default and general with status, filters by kind/status/area", async () => {
    const area = await areas.create({ title: "학위" });
    const r = await projects.create({
      title: "논문 연구",
      areaId: area.id,
      nextAction: " 초록 쓰기 ",
    });
    expect(r).toMatchObject({
      kind: "research",
      status: "active",
      areaId: area.id,
      nextAction: "초록 쓰기",
    });
    const g = await projects.create({ title: "이사", kind: "general", status: "on_hold" });
    expect(g).toMatchObject({ kind: "general", status: "on_hold", stage: "exploring" });

    expect((await projects.list({ kind: "general" })).map((p) => p.id)).toEqual([g.id]);
    expect((await projects.list({ status: "on_hold" })).map((p) => p.id)).toEqual([g.id]);
    expect((await projects.list({ areaId: area.id })).map((p) => p.id)).toEqual([r.id]);

    const done = await projects.update(r.id, { stage: "submitted" });
    expect(done).toMatchObject({ status: "done" });
    expect(done!.completedAt).not.toBeNull();
    expect((await projects.listByStage()).flatMap((c) => c.items)).toEqual([]);
    expect(await projects.listActiveGeneral()).toHaveLength(1);

    await expect(projects.create({ title: "x", areaId: "seed-area-404" })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(await projects.update(g.id, { areaId: null })).toMatchObject({ areaId: null });
  });

  it("listByStage shows research projects only", async () => {
    await projects.create({ title: "R", stage: "drafting" });
    await projects.create({ title: "G", kind: "general" });
    const items = (await projects.listByStage()).flatMap((c) => c.items.map((p) => p.title));
    expect(items).toEqual(["R"]);
  });
});

describe("areas", () => {
  it("keeps order, reorders and appends", async () => {
    const [a, b] = await areas.createMany([{ title: "연구 분야" }, { title: "건강" }]);
    const c = await areas.create({ title: "커리어", standard: "분기마다 이력 갱신" });
    expect((await areas.list()).map((x) => x.title)).toEqual(["연구 분야", "건강", "커리어"]);
    expect(c.standard).toBe("분기마다 이력 갱신");
    await areas.reorder([c.id, a.id, b.id]);
    expect((await areas.list()).map((x) => x.title)).toEqual(["커리어", "연구 분야", "건강"]);
    await expect(areas.reorder([a.id, b.id])).rejects.toBeInstanceOf(RepoError);
    await expect(areas.reorder([a.id, a.id, b.id])).rejects.toBeInstanceOf(RepoError);
  });

  it("deleting an area keeps its projects, unassigned, and removes links and tags", async () => {
    const area = await areas.create({ title: "학위", tags: ["학교"] });
    const p = await projects.create({ title: "논문", areaId: area.id });
    const t = await thoughts.create({ title: "메모" });
    await links.link({ type: "thought", id: t.id }, { type: "area", id: area.id });
    expect(await links.listConnected({ type: "thought", id: t.id })).toEqual([
      { ref: { type: "area", id: area.id }, type: "area", title: "학위", archived: false },
    ]);
    expect(await areas.remove(area.id)).toBe(true);
    expect(await projects.get(p.id)).toMatchObject({ areaId: null });
    expect(await links.listConnected({ type: "thought", id: t.id })).toEqual([]);
    expect(await tags.listAll()).toEqual([]);
  });
});

describe("archive", () => {
  it("hides archived items from lists, home, picker and kanban; unarchive restores", async () => {
    const p = await papers.create({ title: "보관할 논문", tags: ["NLP"] });
    await papers.saveProgress(p.id, { page: 2, scroll: 0 });
    const s = await seminars.create({ title: "보관할 세미나" });
    const pr = await projects.create({ title: "보관할 연구" });
    const a = await areas.create({ title: "보관할 영역" });
    const keep = await papers.create({ title: "남는 논문", tags: ["NLP"] });

    for (const ref of [
      { type: "paper", id: p.id },
      { type: "seminar", id: s.id },
      { type: "project", id: pr.id },
      { type: "area", id: a.id },
    ] as const) {
      expect(await archive.archive(ref)).toBe(true);
    }

    expect((await papers.list()).map((x) => x.id)).toEqual([keep.id]);
    expect(await papers.list({ onlyArchived: true })).toHaveLength(1);
    expect(await papers.list({ includeArchived: true })).toHaveLength(2);
    expect(await papers.listContinueReading()).toEqual([]);
    expect(await seminars.listRecent()).toEqual([]);
    expect((await projects.listByStage()).flatMap((c) => c.items)).toEqual([]);
    expect(await areas.list()).toEqual([]);
    expect((await items.searchTitles("보관")).map((x) => x.title)).toEqual([]);
    expect(await tags.listAll({ visibleOnly: true })).toEqual([{ name: "NLP", count: 1 }]);
    expect(await tags.listAll()).toEqual([{ name: "NLP", count: 2 }]);
    expect((await archive.listArchived()).map((x) => x.type).sort()).toEqual([
      "area",
      "paper",
      "project",
      "seminar",
    ]);
    // archiving is not an edit
    expect((await papers.get(p.id))!.updatedAt).toBe(p.updatedAt);
    await expect(projects.create({ title: "x", areaId: a.id })).rejects.toMatchObject({
      code: "not_found",
    });

    expect(await archive.unarchive({ type: "paper", id: p.id })).toBe(true);
    expect(await papers.list()).toHaveLength(2);
    expect(await archive.archive({ type: "thought", id: "seed-thought-404" })).toBe(false);
  });
});

describe("inbox", () => {
  it("lists untagged, unlinked, unarchived thoughts", async () => {
    const a = await thoughts.create({ title: "A" });
    const b = await thoughts.create({ title: "B" });
    const c = await thoughts.create({ title: "C" });
    const d = await thoughts.create({ title: "D" });
    const paper = await papers.create({ title: "P" });
    expect(await thoughts.countInbox()).toBe(4);

    await tags.setTags({ type: "thought", id: a.id }, ["정리"]);
    await links.link({ type: "paper", id: paper.id }, { type: "thought", id: b.id });
    await archive.archive({ type: "thought", id: c.id });

    expect((await thoughts.listInbox()).map((t) => t.id)).toEqual([d.id]);
    expect(await thoughts.countInbox()).toBe(1);
  });
});
