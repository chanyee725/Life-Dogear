import { describe, expect, it } from "vitest";
import {
  countByType,
  densityRatio,
  filterByType,
  groupTopicsByInitial,
  initialOf,
  initialsOf,
  matchesTopic,
  parseSortParam,
  parseTypeParam,
  resourcesHref,
  sortTopics,
  topicSearchKey,
} from "@/app/resources/resource-data";

const t = (name: string, count: number) => ({ name, count });

describe("initialOf / initialsOf", () => {
  it("gives the leading consonant, folding doubles, A–Z for Latin and # otherwise", () => {
    expect(initialOf("강화학습")).toBe("ㄱ");
    expect(initialOf("까치")).toBe("ㄱ");
    expect(initialOf("쌍둥이")).toBe("ㅅ");
    expect(initialOf("효율")).toBe("ㅎ");
    expect(initialOf("nlp")).toBe("N");
    expect(initialOf(" LLM")).toBe("L");
    expect(initialOf("3D")).toBe("#");
    expect(initialOf("ㅌ")).toBe("ㅌ");
    expect(initialOf("")).toBe("#");
  });

  it("spells out every syllable's initial, keeping other characters", () => {
    expect(initialsOf("통계검정")).toBe("ㅌㄱㄱㅈ");
    expect(initialsOf("질적 연구")).toBe("ㅈㅈ ㅇㄱ");
    expect(initialsOf("NLP 기초")).toBe("nlp ㄱㅊ");
  });
});

describe("sortTopics / groupTopicsByInitial", () => {
  const topics = [
    t("효율", 2),
    t("NLP", 5),
    t("강화학습", 5),
    t("검색", 1),
    t("3D", 1),
    t("까치", 2),
  ];

  it("orders by count, ties by name", () => {
    expect(sortTopics(topics, "count").map((x) => x.name)).toEqual([
      "강화학습",
      "NLP",
      "까치",
      "효율",
      "검색",
      "3D",
    ]);
  });

  it("orders by name with Hangul first, then Latin, then others", () => {
    expect(sortTopics(topics, "name").map((x) => x.name)).toEqual([
      "강화학습",
      "검색",
      "까치",
      "효율",
      "NLP",
      "3D",
    ]);
  });

  it("groups consecutive initials with their topics", () => {
    expect(groupTopicsByInitial(topics).map((g) => [g.key, g.topics.map((x) => x.name)])).toEqual([
      ["ㄱ", ["강화학습", "검색", "까치"]],
      ["ㅎ", ["효율"]],
      ["N", ["NLP"]],
      ["#", ["3D"]],
    ]);
  });

  it("does not change the input", () => {
    const copy = [...topics];
    sortTopics(topics, "name");
    expect(topics).toEqual(copy);
  });
});

describe("densityRatio", () => {
  it("is the share of the largest count, clamped to [0, 1]", () => {
    expect(densityRatio(6, 12)).toBe(0.5);
    expect(densityRatio(12, 12)).toBe(1);
    expect(densityRatio(20, 12)).toBe(1);
    expect(densityRatio(0, 12)).toBe(0);
    expect(densityRatio(3, 0)).toBe(0);
  });
});

describe("matchesTopic", () => {
  const key = topicSearchKey("통계검정");
  it("matches name substrings case-insensitively", () => {
    expect(matchesTopic(key, "계검")).toBe(true);
    expect(matchesTopic(topicSearchKey("NLP"), "nl")).toBe(true);
    expect(matchesTopic(key, "")).toBe(true);
    expect(matchesTopic(key, "회귀")).toBe(false);
  });

  it("matches bare consonants against the initial sounds only", () => {
    expect(matchesTopic(key, "ㅌㄱ")).toBe(true);
    expect(matchesTopic(key, "ㄱㅈ")).toBe(true);
    expect(matchesTopic(key, "ㅎㄱ")).toBe(false);
  });
});

describe("type and sort params", () => {
  it("accepts only the three resource types", () => {
    expect(parseTypeParam("paper")).toBe("paper");
    expect(parseTypeParam(["thought", "paper"])).toBe("thought");
    expect(parseTypeParam("project")).toBeNull();
    expect(parseTypeParam(undefined)).toBeNull();
  });

  it("defaults the sort to count", () => {
    expect(parseSortParam("name")).toBe("name");
    expect(parseSortParam("count")).toBe("count");
    expect(parseSortParam("x")).toBe("count");
  });

  it("keeps type (with a topic) and a non-default sort in the link", () => {
    expect(resourcesHref("NLP", { type: "paper", sort: "name" })).toBe(
      "/resources?topic=NLP&type=paper&sort=name",
    );
    expect(resourcesHref("NLP", { type: null, sort: "count" })).toBe("/resources?topic=NLP");
    expect(resourcesHref(null, { type: "paper", sort: "name" })).toBe("/resources?sort=name");
  });

  it("counts and filters items by type", () => {
    const items = [
      { type: "paper" as const },
      { type: "paper" as const },
      { type: "thought" as const },
    ];
    expect(countByType(items)).toEqual({ paper: 2, note: 0, seminar: 0, thought: 1 });
    expect(filterByType(items, "thought")).toHaveLength(1);
    expect(filterByType(items, null)).toHaveLength(3);
  });
});
