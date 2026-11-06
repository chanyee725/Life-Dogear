import { describe, expect, it } from "vitest";
import { itemPath, parseRef, pickItem, shortId, slugify, tagPath } from "@/lib/item-path";

const ID = "3f9a1c2e-1111-4222-8333-444455556666";
const TWIN = "3f9a1c2e-9999-4aaa-8bbb-ccccddddeeee";

describe("slugify", () => {
  it("keeps Hangul and digits, lowercases, collapses symbols", () => {
    expect(slugify("Deep Learning 101: 입문!")).toBe("deep-learning-101-입문");
    expect(slugify("  --A  &&  B--  ")).toBe("a-b");
    expect(slugify("논문 / 읽기 (2판)")).toBe("논문-읽기-2판");
  });

  it("is empty for empty or symbol-only titles", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!! ???")).toBe("");
  });

  it("cuts at 60 chars without a trailing dash", () => {
    const long = slugify("가".repeat(59) + " 나다라");
    expect(Array.from(long).length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
    expect(Array.from(slugify("a".repeat(100))).length).toBe(60);
  });
});

describe("shortId / itemPath", () => {
  it("uses the first 8 hex chars", () => {
    expect(shortId(ID.toUpperCase())).toBe("3f9a1c2e");
    expect(itemPath("notes", ID, "My Note")).toBe("/notes/my-note-3f9a1c2e");
  });

  it("falls back to the short id for an empty title", () => {
    expect(itemPath("papers", ID, "")).toBe("/papers/3f9a1c2e");
    expect(itemPath("papers", ID, null)).toBe("/papers/3f9a1c2e");
    expect(itemPath("papers", ID)).toBe("/papers/3f9a1c2e");
  });

  it("keeps seed ids and name-based tags as they are", () => {
    expect(itemPath("projects", "seed-project-1", "Sample")).toBe("/projects/seed-project-1");
    expect(itemPath("tags", "머신 러닝")).toBe(tagPath("머신 러닝"));
    expect(tagPath("a/b")).toBe("/tags/a%2Fb");
  });
});

describe("parseRef", () => {
  it("accepts slug-shortid, bare shortid and full uuid", () => {
    expect(parseRef("my-note-3f9a1c2e")).toEqual({ kind: "short", short: "3f9a1c2e" });
    expect(parseRef("논문-3F9A1C2E")).toEqual({ kind: "short", short: "3f9a1c2e" });
    expect(parseRef("3f9a1c2e")).toEqual({ kind: "short", short: "3f9a1c2e" });
    expect(parseRef(ID)).toEqual({ kind: "uuid", id: ID });
    expect(parseRef(`slug-${ID}`)).toEqual({ kind: "uuid", id: ID });
    expect(parseRef("%EB%85%BC%EB%AC%B8-3f9a1c2e")).toEqual({ kind: "short", short: "3f9a1c2e" });
  });

  it("accepts seed ids as exact ids", () => {
    expect(parseRef("seed-paper-1")).toEqual({ kind: "uuid", id: "seed-paper-1" });
  });

  it("rejects anything else", () => {
    for (const bad of [
      "",
      "new",
      "note",
      "3f9a1c2",
      "3f9a1c2g",
      "x3f9a1c2e",
      "slug-3f9a1c2e0",
      "%",
      "a%_b",
      "%%%%%%%%",
      "slug-____%%%%",
      "a".repeat(500) + "-3f9a1c2e",
    ]) {
      expect(parseRef(bad), bad).toBeNull();
    }
  });
});

describe("pickItem", () => {
  const one = [{ id: ID, title: "My Note" }];

  it("resolves a unique prefix and reports the canonical segment", () => {
    expect(pickItem("my-note-3f9a1c2e", parseRef("my-note-3f9a1c2e")!, one)).toEqual({
      id: ID,
      segment: "my-note-3f9a1c2e",
    });
    expect(pickItem(ID, parseRef(ID)!, one)).toEqual({ id: ID, segment: "my-note-3f9a1c2e" });
    expect(pickItem("old-slug-3f9a1c2e", parseRef("old-slug-3f9a1c2e")!, one)?.segment).toBe(
      "my-note-3f9a1c2e",
    );
  });

  it("returns null when nothing matches", () => {
    expect(pickItem("3f9a1c2e", parseRef("3f9a1c2e")!, [])).toBeNull();
    expect(pickItem(TWIN, parseRef(TWIN)!, one)).toBeNull();
  });

  it("uses the full uuid when two items share the prefix", () => {
    const twins = [...one, { id: TWIN, title: "Other" }];
    expect(pickItem(ID, parseRef(ID)!, twins)).toEqual({ id: ID, segment: `my-note-${ID}` });
    // Short form: the slug disambiguates; without it, nothing resolves.
    expect(pickItem("other-3f9a1c2e", parseRef("other-3f9a1c2e")!, twins)?.id).toBe(TWIN);
    expect(pickItem("3f9a1c2e", parseRef("3f9a1c2e")!, twins)).toBeNull();
  });

  it("resolves seed ids exactly", () => {
    const seed = [{ id: "seed-paper-1", title: "Sample" }];
    expect(pickItem("seed-paper-1", parseRef("seed-paper-1")!, seed)).toEqual({
      id: "seed-paper-1",
      segment: "seed-paper-1",
    });
  });
});
