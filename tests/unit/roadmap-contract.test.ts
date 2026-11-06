import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRoadmap, parseRoadmapJson } from "@/lib/roadmap/contract";

const fixture = () =>
  JSON.parse(readFileSync("tests/e2e/fixtures/roadmap.json", "utf8")) as Record<string, any>;

describe("roadmap JSON contract", () => {
  it("accepts the e2e fixture", () => {
    const result = parseRoadmap(fixture());
    expect(result.ok).toBe(true);
  });

  it("fills defaults for optional fields", () => {
    const result = parseRoadmap({
      slug: "x",
      title: "X",
      topic: "X",
      stages: [{ title: "S", items: [{ title: "I", priority: "optional" }] }],
    });
    expect(result.ok && result.roadmap.stages[0]!.items[0]).toEqual({
      title: "I",
      priority: "optional",
      description: "",
      resources: [],
      children: [],
    });
  });

  it("rejects bad priority, non-http url, deep nesting and duplicate siblings", () => {
    const badPriority = fixture();
    badPriority.stages[0].items[0].priority = "must";
    expect(parseRoadmap(badPriority).ok).toBe(false);

    const badUrl = fixture();
    badUrl.stages[0].items[0].resources[0].url = "javascript:alert(1)";
    expect(parseRoadmap(badUrl).ok).toBe(false);

    const deep = fixture();
    deep.stages[0].items[0].children[0].children[0].children = [
      { title: "too deep", priority: "optional" },
    ];
    expect(parseRoadmap(deep).ok).toBe(false);

    const dup = fixture();
    dup.stages[1].title = dup.stages[0].title;
    expect(parseRoadmap(dup).ok).toBe(false);

    expect(parseRoadmapJson("{not json").ok).toBe(false);
  });
});
