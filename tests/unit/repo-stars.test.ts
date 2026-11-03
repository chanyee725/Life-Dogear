import { beforeEach, describe, expect, it } from "vitest";
import { papers, projects, RepoError } from "@/lib/repo";
import { isStarred, listStarredKeys, setStarred } from "@/lib/repo/stars";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

describe("stars repo", () => {
  it("stars and unstars an item, idempotently", async () => {
    const p = await papers.create({ title: "논문" });
    const ref = { type: "paper" as const, id: p.id };
    expect(await isStarred(ref)).toBe(false);
    await setStarred(ref, true);
    await setStarred(ref, true);
    expect(await isStarred(ref)).toBe(true);
    expect(await listStarredKeys()).toEqual(new Set([`paper:${p.id}`]));
    await setStarred(ref, false);
    await setStarred(ref, false);
    expect(await isStarred(ref)).toBe(false);
    expect((await listStarredKeys()).size).toBe(0);
  });

  it("refuses missing items and invalid refs", async () => {
    await expect(setStarred({ type: "paper", id: "seed-missing" }, true)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(setStarred({ type: "nope" as "paper", id: "x" }, true)).rejects.toBeInstanceOf(
      RepoError,
    );
  });

  it("removes the star when the item is deleted", async () => {
    const pr = await projects.create({ title: "프로젝트" });
    await setStarred({ type: "project", id: pr.id }, true);
    await projects.remove(pr.id);
    expect((await listStarredKeys()).size).toBe(0);
  });
});
