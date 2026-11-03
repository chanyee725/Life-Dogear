import { beforeEach, describe, expect, it } from "vitest";
import { highlights } from "@/db/schema";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { setDb } from "@/db/client";
import * as schema from "@/db/schema";
import { archive, areas, goals, papers, projects, seminars, thoughts } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { searchAll } from "@/lib/search";
import {
  clampLimit,
  compareHits,
  escapeLike,
  graphemeBoundary,
  makeSnippet,
  normalizeQuery,
  plainText,
  titleScore,
} from "@/lib/search/text";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;

beforeEach(async () => {
  db = await useFreshDb();
});

async function addHighlight(paperId: string, page: number, text: string, note = "", rects = "[]") {
  const id = crypto.randomUUID();
  await db.insert(highlights).values({
    id,
    paperId,
    page,
    text,
    note,
    rects,
    createdAt: new Date().toISOString(),
  });
  return id;
}

describe("text helpers", () => {
  it("normalizes queries to trimmed NFC with collapsed spaces", () => {
    const nfd = "한국어".normalize("NFD");
    expect(normalizeQuery(`  ${nfd}   검색 `)).toBe("한국어 검색");
    expect(normalizeQuery(42)).toBe("");
    expect(normalizeQuery("a".repeat(500))).toHaveLength(200);
  });

  it("escapes LIKE wildcards and clamps limits", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(999)).toBe(50);
    expect(clampLimit("7")).toBe(7);
  });

  it("builds snippets around the match, keeping original case", () => {
    const s = makeSnippet("Self-Attention is all you need", "attention");
    expect(s).toEqual({ before: "Self-", match: "Attention", after: " is all you need" });
    const long = makeSnippet(`${"가".repeat(50)}목표${"나".repeat(100)}`, "목표")!;
    expect(long.before.startsWith("…")).toBe(true);
    expect(long.after.endsWith("…")).toBe(true);
    expect(long.match).toBe("목표");
    expect(makeSnippet("없음", "있음")).toBeNull();
  });

  it("cuts snippets and queries at whole characters, ZWJ emoji included", () => {
    const family = "👨‍👩‍👧‍👦";
    for (let lead = 0; lead < 12; lead++) {
      const s = makeSnippet(
        `${"가".repeat(lead + 20)}${family.repeat(3)}목표${family.repeat(10)}`,
        "목표",
      )!;
      const parts = (x: string) => x.replace(/…/g, "").split(family).join("");
      // Only whole families remain around the match.
      expect(parts(s.before)).toMatch(/^가*$/);
      expect(parts(s.after)).toBe("");
    }
    const q = normalizeQuery(`${"a".repeat(195)}${family}`);
    expect(q).toBe("a".repeat(195));
    expect(graphemeBoundary("a😀b", 2, -1)).toBe(1);
    expect(graphemeBoundary("a😀b", 2, 1)).toBe(3);
    expect(graphemeBoundary("abc", 1, 1)).toBe(1);
  });

  it("strips markdown syntax for snippets", () => {
    expect(plainText("## 제목\n- [ ] **굵게** [링크](http://x)")).toBe("제목 굵게 링크");
  });

  it("scores exact > prefix > contains titles", () => {
    expect(titleScore("트랜스포머", "트랜스포머")).toBeGreaterThan(
      titleScore("트랜스포머 정리", "트랜스포머"),
    );
    expect(titleScore("트랜스포머 정리", "트랜스포머")).toBeGreaterThan(
      titleScore("새 트랜스포머", "트랜스포머"),
    );
    expect(titleScore("무관", "트랜스포머")).toBe(0);
  });
});

describe("searchAll", () => {
  it("returns nothing for blank queries", async () => {
    await thoughts.create({ title: "아무거나" });
    expect(await searchAll("   ")).toEqual([]);
    expect(await searchAll(undefined)).toEqual([]);
  });

  it("finds Korean substrings in titles, bodies and key fields across types", async () => {
    const p = await papers.create({
      title: "딥러닝 기반 자연어처리",
      authors: ["김가명"],
      summary: "주의 메커니즘 요약",
    });
    const s = await seminars.create({ title: "봄 세미나", keyLine: "자연어 모델의 한계" });
    const t = await thoughts.create({ title: "메모", body: "## 생각\n자연어처리를 다시 보자" });
    const r = await projects.create({ title: "졸업 연구", researchQuestion: "자연어 이해란?" });

    const hits = await searchAll("자연어");
    expect(hits.map((h) => `${h.type}:${h.id}`).sort()).toEqual(
      [`paper:${p.id}`, `seminar:${s.id}`, `thought:${t.id}`, `project:${r.id}`].sort(),
    );
    expect(hits[0]).toMatchObject({ type: "paper", field: "title", snippet: null });
    expect(hits.find((h) => h.type === "thought")).toMatchObject({
      field: "body",
      href: `/thoughts/${t.id}`,
      snippet: { before: "생각 ", match: "자연어", after: "처리를 다시 보자" },
    });
    expect(hits.find((h) => h.type === "seminar")!.field).toBe("meta");

    expect((await searchAll("김가명")).map((h) => h.id)).toEqual([p.id]);
    expect((await searchAll("메커니즘"))[0]).toMatchObject({ id: p.id, field: "meta" });
  });

  it("ranks exact, then prefix, then contained titles, then other fields", async () => {
    const body = await thoughts.create({ title: "본문만", body: "트랜스포머 이야기" });
    const contains = await thoughts.create({ title: "새 트랜스포머" });
    const prefix = await papers.create({ title: "트랜스포머 정리" });
    const exact = await seminars.create({ title: "트랜스포머" });
    const hits = await searchAll("트랜스포머");
    expect(hits.map((h) => h.id)).toEqual([exact.id, prefix.id, contains.id, body.id]);
  });

  it("is case-insensitive for ASCII and matches decomposed (NFD) stored text", async () => {
    const a = await papers.create({ title: "Attention Is All You Need" });
    const nfd = await thoughts.create({ title: "한글 정규화".normalize("NFD") });
    expect((await searchAll("ATTENTION")).map((h) => h.id)).toEqual([a.id]);
    expect((await searchAll("정규화")).map((h) => h.id)).toEqual([nfd.id]);
  });

  it("treats % and _ literally", async () => {
    const pct = await thoughts.create({ title: "정확도 95% 달성" });
    await thoughts.create({ title: "정확도 950 달성" });
    const under = await thoughts.create({ title: "snake_case 이름" });
    await thoughts.create({ title: "snakeXcase 이름" });
    expect((await searchAll("95%")).map((h) => h.id)).toEqual([pct.id]);
    expect((await searchAll("e_c")).map((h) => h.id)).toEqual([under.id]);
    expect(await searchAll("%")).toHaveLength(1);
  });

  it("finds highlight text and notes with the paper id and page", async () => {
    const p = await papers.create({ title: "읽는 논문" });
    const h1 = await addHighlight(p.id, 3, "잔차 연결은 학습을 안정시킨다");
    const h2 = await addHighlight(p.id, 7, "다른 문장", "잔차 연결 다시 확인");
    const hits = await searchAll("잔차 연결");
    expect(hits.map((h) => h.id)).toEqual(expect.arrayContaining([h1, h2]));
    expect(hits.find((h) => h.id === h1)).toMatchObject({
      type: "highlight",
      title: "읽는 논문",
      field: "highlight",
      paperId: p.id,
      page: 3,
      href: `/papers/${p.id}/read?page=3`,
    });
    // Highlight text outranks a note-only match.
    expect(hits.findIndex((h) => h.id === h1)).toBeLessThan(hits.findIndex((h) => h.id === h2));
    expect(hits.find((h) => h.id === h2)!.field).toBe("note");
  });

  it("respects the limit", async () => {
    for (let i = 0; i < 5; i++) await thoughts.create({ title: `반복 ${i}` });
    expect(await searchAll("반복", { limit: 3 })).toHaveLength(3);
  });

  it("finds non-ASCII capitals spelled the same way (SQL lower() is ASCII-only)", async () => {
    const at = await papers.create({ title: "Österreich und Europa" });
    const ru = await thoughts.create({ title: "메모", body: "Модель внимания" });
    expect((await searchAll("Österreich")).map((h) => h.id)).toEqual([at.id]);
    expect((await searchAll("Модель")).map((h) => h.id)).toEqual([ru.id]);
    // ASCII stays case-insensitive inside mixed queries…
    expect((await searchAll("ÖSTERREICH UND")).map((h) => h.id)).toEqual([at.id]);
    // A lower-case non-ASCII query still misses a capitalised original (documented limit).
    expect(await searchAll("österreich")).toEqual([]);
  });

  it("finds lower-case stored text with an upper-case non-ASCII query", async () => {
    const de = await thoughts.create({ title: "über österreich" });
    const ru = await thoughts.create({ title: "메모", body: "новая модель внимания" });
    const nfd = await thoughts.create({ title: "café crème".normalize("NFD") });
    expect((await searchAll("ÖSTERREICH")).map((h) => h.id)).toEqual([de.id]);
    expect((await searchAll("Über Österreich")).map((h) => h.id)).toEqual([de.id]);
    expect((await searchAll("МОДЕЛЬ"))[0]).toMatchObject({ id: ru.id, field: "body" });
    expect((await searchAll("МОДЕЛЬ"))[0].snippet!.match).toBe("модель");
    expect((await searchAll("CAFÉ CRÈME")).map((h) => h.id)).toEqual([nfd.id]);
  });

  it("matches authors without their JSON quotes, commas and brackets", async () => {
    const a = await papers.create({ title: "저자 둘", authors: ["김가명", "Lee Fake"] });
    const none = await papers.create({ title: "저자 없음", authors: ["단독"] });
    const quoted = await thoughts.create({ title: '인용 "따옴표" 있음' });
    const comma = await thoughts.create({ title: "쉼표, 있음", body: "[대괄호] 본문" });
    expect((await searchAll('"')).map((h) => h.id)).toEqual([quoted.id]);
    // "," matches the shown "김가명, Lee Fake" list, but not a one-author paper's JSON.
    expect((await searchAll(",")).map((h) => h.id).sort()).toEqual([comma.id, a.id].sort());
    expect((await searchAll(",")).map((h) => h.id)).not.toContain(none.id);
    expect((await searchAll("[")).map((h) => h.id)).toEqual([comma.id]);
    // The joined author list still matches across the separator.
    expect((await searchAll("김가명, Lee"))[0]).toMatchObject({ id: a.id, field: "meta" });
    expect((await searchAll("fake"))[0]).toMatchObject({
      id: a.id,
      snippet: { before: "김가명, Lee ", match: "Fake", after: "" },
    });
  });

  it("still finds a body match in a paper whose authors list hit only via JSON", async () => {
    const p = await papers.create({ title: "본문 따옴표", authors: ["A"] });
    await papers.update(p.id, { body: '그는 "핵심"이라고 말했다' });
    // Before: the authors JSON matched `"`, the body was withheld, and the hit was lost.
    const hits = await searchAll('"');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: p.id, field: "body", snippet: { match: '"' } });
  });

  it("builds body snippets from a window around a match deep in a long body", async () => {
    const body = `${"앞 문단입니다. ".repeat(2_000)}여기서 핵심어가 나온다${" 뒤 문단.".repeat(2_000)}`;
    const t = await thoughts.create({ title: "긴 글", body });
    const [hit] = await searchAll("핵심어");
    expect(hit).toMatchObject({ id: t.id, field: "body" });
    expect(hit.snippet!.match).toBe("핵심어");
    expect(hit.snippet!.before).toMatch(/^….*여기서 $/);
    expect(hit.snippet!.after).toMatch(/^가 나온다.*…$/);
  });

  it("finds a body match near the very start and end of the body", async () => {
    const start = await thoughts.create({ title: "시작", body: `처음단어 ${"가".repeat(5_000)}` });
    const end = await thoughts.create({ title: "끝", body: `${"나".repeat(5_000)} 마지막단어` });
    expect((await searchAll("처음단어"))[0]).toMatchObject({
      id: start.id,
      snippet: { before: "", match: "처음단어" },
    });
    expect((await searchAll("마지막단어"))[0]).toMatchObject({
      id: end.id,
      snippet: { match: "마지막단어", after: "" },
    });
  });

  it("links a highlight to its spot on the page (scroll from its rects)", async () => {
    const p = await papers.create({ title: "위치 논문" });
    const rects = JSON.stringify([
      { x: 0.1, y: 0.45, w: 0.5, h: 0.02 },
      { x: 0.1, y: 0.47, w: 0.3, h: 0.02 },
    ]);
    await addHighlight(p.id, 4, "정확한 위치로 이동", "", rects);
    const [hit] = await searchAll("정확한 위치");
    expect(hit.href).toBe(`/papers/${p.id}/read?page=4&scroll=0.4`);
    // Broken stored rects fall back to the top of the page.
    await addHighlight(p.id, 6, "깨진 좌표 하이라이트", "", "not json");
    expect((await searchAll("깨진 좌표"))[0].href).toBe(`/papers/${p.id}/read?page=6`);
  });

  it("finds authors by quote and backslash characters inside their names", async () => {
    const q = await papers.create({ title: "따옴표 저자", authors: ['Kim "Q" Fake', "Lee"] });
    const bs = await papers.create({ title: "역슬래시 저자", authors: ["C\\D Sample"] });
    const tail = await papers.create({ title: "끝 역슬래시", authors: ["Ends\\", "Next"] });
    expect((await searchAll('"Q"')).map((h) => h.id)).toEqual([q.id]);
    expect((await searchAll('"Q"'))[0]).toMatchObject({ field: "meta", snippet: { match: '"Q"' } });
    expect((await searchAll("C\\D")).map((h) => h.id)).toEqual([bs.id]);
    // `\\` followed by the closing quote is a backslash, not an escaped quote.
    expect((await searchAll("Ends\\, Next")).map((h) => h.id)).toEqual([tail.id]);
  });
});

describe("areas and archived items (phase 1.5)", () => {
  it("finds areas by title, standard and body and links to /areas/<id>", async () => {
    const byTitle = await areas.create({ title: "건강 관리" });
    const byStandard = await areas.create({ title: "학위", standard: "건강 검진 일정을 챙긴다" });
    const byBody = await areas.create({ title: "커리어", body: "## 메모\n건강 보험 서류" });
    const hits = await searchAll("건강");
    expect(hits.map((h) => h.id)).toEqual([byTitle.id, byStandard.id, byBody.id]);
    expect(hits[0]).toMatchObject({
      type: "area",
      field: "title",
      href: `/areas/${byTitle.id}`,
      archived: false,
    });
    expect(hits[1]).toMatchObject({ field: "meta", snippet: { match: "건강" } });
    expect(hits[2]).toMatchObject({ field: "body", snippet: { before: "메모 ", match: "건강" } });
  });

  it("finds a project by its next action", async () => {
    const p = await projects.create({ title: "학회 준비", nextAction: "포스터 초안 보내기" });
    expect((await searchAll("포스터"))[0]).toMatchObject({ id: p.id, field: "meta" });
  });

  it("keeps archived items in the results, flagged, without hiding them", async () => {
    const kept = await thoughts.create({ title: "보관 테스트 생각" });
    const gone = await areas.create({ title: "보관 테스트 영역" });
    const paper = await papers.create({ title: "보관 테스트 논문" });
    const project = await projects.create({ title: "보관 테스트 프로젝트" });
    const seminar = await seminars.create({ title: "보관 테스트 세미나" });
    for (const ref of [
      { type: "area" as const, id: gone.id },
      { type: "paper" as const, id: paper.id },
      { type: "project" as const, id: project.id },
      { type: "seminar" as const, id: seminar.id },
    ]) {
      expect(await archive.archive(ref)).toBe(true);
    }
    const hits = await searchAll("보관 테스트");
    expect(Object.fromEntries(hits.map((h) => [h.id, h.archived]))).toEqual({
      [kept.id]: false,
      [gone.id]: true,
      [paper.id]: true,
      [project.id]: true,
      [seminar.id]: true,
    });
    // Unarchiving clears the flag.
    await archive.unarchive({ type: "paper", id: paper.id });
    expect((await searchAll("보관 테스트 논문"))[0]).toMatchObject({
      id: paper.id,
      archived: false,
    });
  });

  it("does not demote a better archived match; breaks equal scores toward active items", async () => {
    const archivedExact = await thoughts.create({ title: "어텐션" });
    await archive.archive({ type: "thought", id: archivedExact.id });
    const activePrefix = await thoughts.create({ title: "어텐션 정리" });
    const archivedPrefix = await papers.create({ title: "어텐션 논문" });
    await archive.archive({ type: "paper", id: archivedPrefix.id });
    // Created (and so updated) last, yet archived: goes after the active prefix match.
    expect((await searchAll("어텐션")).map((h) => [h.id, h.archived])).toEqual([
      [archivedExact.id, true],
      [activePrefix.id, false],
      [archivedPrefix.id, true],
    ]);
  });

  it("flags highlights of an archived paper as archived", async () => {
    const live = await papers.create({ title: "살아 있는 논문" });
    const shelved = await papers.create({ title: "보관한 논문" });
    const h1 = await addHighlight(live.id, 1, "공통 하이라이트 문장");
    const h2 = await addHighlight(shelved.id, 2, "공통 하이라이트 문장");
    await archive.archive({ type: "paper", id: shelved.id });
    const hits = await searchAll("공통 하이라이트");
    expect(hits.map((h) => [h.id, h.type, h.archived])).toEqual([
      [h1, "highlight", false],
      [h2, "highlight", true],
    ]);
    expect(hits[1]).toMatchObject({ title: "보관한 논문", page: 2 });
  });

  it("orders equal hits: score, then active before archived, then newest", () => {
    const base = {
      type: "thought" as const,
      title: "",
      snippet: null,
      field: "title" as const,
      href: "",
    };
    const hit = (id: string, score: number, archived: boolean, updatedAt: string) => ({
      ...base,
      id,
      score,
      archived,
      updatedAt,
    });
    const sorted = [
      hit("old-active", 60, false, "2026-01-01"),
      hit("new-archived", 60, true, "2026-06-01"),
      hit("new-active", 60, false, "2026-06-01"),
      hit("best-archived", 100, true, "2025-01-01"),
    ].sort(compareHits);
    expect(sorted.map((h) => h.id)).toEqual([
      "best-archived",
      "new-active",
      "old-active",
      "new-archived",
    ]);
  });
});

describe("goals and reviews", () => {
  it("finds goals by title, why and body and links to /goals/<id>", async () => {
    const byTitle = await goals.create({ title: "체력 기르기", horizon: "life" });
    const byWhy = await goals.create({ title: "학위", horizon: "life", why: "체력이 버텨야 한다" });
    const byBody = await goals.create({
      title: "건강",
      horizon: "life",
      body: "## 계획\n체력 측정",
    });
    const hits = await searchAll("체력");
    expect(hits.map((h) => h.id)).toEqual([byTitle.id, byWhy.id, byBody.id]);
    expect(hits[0]).toMatchObject({
      type: "goal",
      field: "title",
      href: `/goals/${byTitle.id}`,
      archived: false,
    });
    expect(hits[1]).toMatchObject({ field: "meta", snippet: { match: "체력" } });
    expect(hits[2]).toMatchObject({ field: "body", snippet: { before: "계획 ", match: "체력" } });
  });

  it("finds reviews by title and body and links to /reviews/<id>", async () => {
    const { review } = await reviews.open("week", "2026-W45");
    await reviews.update(review.id, { body: "## 잘한 점\n실험 재현 성공" });
    const [byTitle] = await searchAll("2026-W45");
    expect(byTitle).toMatchObject({
      type: "review",
      id: review.id,
      field: "title",
      href: `/reviews/${review.id}`,
    });
    const [byBody] = await searchAll("재현");
    expect(byBody).toMatchObject({ type: "review", field: "body", snippet: { match: "재현" } });
  });

  it("keeps archived goals and reviews in the results, flagged", async () => {
    const goal = await goals.create({ title: "보관 목표", horizon: "life" });
    const { review } = await reviews.open("month", "2026-10");
    await reviews.update(review.id, { body: "보관 목표 돌아보기" });
    await archive.archive({ type: "goal", id: goal.id });
    await archive.archive({ type: "review", id: review.id });
    const hits = await searchAll("보관 목표");
    expect(hits.map((h) => [h.type, h.id, h.archived])).toEqual([
      ["goal", goal.id, true],
      ["review", review.id, true],
    ]);
  });
});

describe("query count", () => {
  let queries = 0;
  beforeEach(async () => {
    const counting = drizzle(createClient({ url: ":memory:" }), {
      schema,
      logger: { logQuery: () => void queries++ },
    });
    await migrate(counting, { migrationsFolder: "drizzle" });
    setDb(counting);
  });

  async function countSearch(q: string): Promise<number> {
    queries = 0;
    await searchAll(q);
    return queries;
  }

  it("runs one query per source (7 item types + highlights), however many rows match", async () => {
    expect(await countSearch("목표")).toBe(8);
    for (let i = 0; i < 3; i++) {
      await goals.create({ title: `목표 ${i}`, horizon: "life" });
      await thoughts.create({ title: `목표 생각 ${i}` });
    }
    await reviews.open("week", "2026-W44");
    expect(await countSearch("목표")).toBe(8);
  });
});
