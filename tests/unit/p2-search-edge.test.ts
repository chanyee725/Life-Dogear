import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { highlights, papers as papersTable, thoughts as thoughtsTable } from "@/db/schema";
import { papers, projects, seminars, thoughts } from "@/lib/repo";
import { MAX_QUERY_LENGTH, searchAll } from "@/lib/search";
import { makeSnippet, normalizeQuery } from "@/lib/search/text";
import { useFreshDb } from "./repo-helpers";

let db: Awaited<ReturnType<typeof useFreshDb>>;

beforeEach(async () => {
  db = await useFreshDb();
});

async function addHighlight(paperId: string, page: number, text: string, note = "") {
  const id = crypto.randomUUID();
  await db
    .insert(highlights)
    .values({ id, paperId, page, text, note, createdAt: new Date().toISOString() });
  return id;
}

const ids = (hits: { id: string }[]) => hits.map((h) => h.id);
/** A lone (unpaired) UTF-16 surrogate means a snippet cut an emoji in half. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("Korean composition forms", () => {
  it("finds NFD-stored titles, bodies, key fields and highlights with NFC and NFD queries", async () => {
    const nfd = (s: string) => s.normalize("NFD");
    const t = await thoughts.create({ title: nfd("조합형 제목"), body: nfd("본문의 한글 문장") });
    const p = await papers.create({ title: "논문", summary: nfd("요약 한글") });
    const h = await addHighlight(p.id, 1, nfd("하이라이트 한글"));

    for (const q of ["조합형", nfd("조합형")]) expect(ids(await searchAll(q))).toEqual([t.id]);
    expect(ids(await searchAll("한글 문장"))).toEqual([t.id]);
    expect(ids(await searchAll(nfd("한글 문장")))).toEqual([t.id]);
    const hits = await searchAll("한글");
    expect(ids(hits)).toEqual(expect.arrayContaining([t.id, p.id, h]));
  });

  it("returns snippets in NFC with a match that equals the query text", async () => {
    await thoughts.create({
      title: "메모",
      body: "앞 문장 ".normalize("NFD") + "한글 검색어 뒤".normalize("NFD"),
    });
    const [hit] = await searchAll("검색어");
    expect(hit.snippet).not.toBeNull();
    expect(hit.snippet!.match).toBe("검색어");
    expect(hit.snippet!.before).toBe(hit.snippet!.before.normalize("NFC"));
  });

  it("does not match a different syllable that merely shares a leading consonant", async () => {
    await thoughts.create({ title: "가나다" });
    expect(await searchAll("각")).toEqual([]);
    expect(await searchAll("ㄱ")).toEqual([]);
  });
});

describe("short, blank and odd queries", () => {
  it("searches two-character and one-character queries", async () => {
    const t = await thoughts.create({ title: "자연 이야기" });
    await thoughts.create({ title: "무관한 글" });
    expect(ids(await searchAll("자연"))).toEqual([t.id]);
    expect(ids(await searchAll("자"))).toEqual([t.id]);
  });

  it("returns nothing for blank, whitespace-only and non-string queries", async () => {
    await thoughts.create({ title: "아무거나", body: "내용" });
    for (const q of ["", " ", "\t\n  \r\n", "\u00a0", "\u3000", null, undefined, 0, {}, []]) {
      expect(await searchAll(q)).toEqual([]);
    }
  });

  it("collapses inner whitespace and trims around the query", async () => {
    const t = await thoughts.create({ title: "attention is all" });
    expect(ids(await searchAll("  attention \n\t is   all "))).toEqual([t.id]);
  });

  it("returns an empty list when nothing matches", async () => {
    await thoughts.create({ title: "존재하는 글" });
    expect(await searchAll("없는검색어")).toEqual([]);
  });
});

describe("LIKE and SQL metacharacters are literal", () => {
  it("handles %, _, backslash and quotes", async () => {
    const pct = await thoughts.create({ title: "100% 확실" });
    const und = await thoughts.create({ title: "a_b 변수" });
    const bs = await thoughts.create({ title: "경로 C:\\temp\\file" });
    const quote = await thoughts.create({ title: "O'Brien 논문" });
    const dq = await thoughts.create({ title: 'say "hello" 인용' });
    // Decoys that wildcards or unescaped quotes would wrongly match.
    await thoughts.create({ title: "1000 확실" });
    await thoughts.create({ title: "aXb 변수" });
    await thoughts.create({ title: "경로 C:/temp/file" });

    expect(ids(await searchAll("100%"))).toEqual([pct.id]);
    expect(ids(await searchAll("a_b"))).toEqual([und.id]);
    expect(ids(await searchAll("\\temp\\"))).toEqual([bs.id]);
    expect(ids(await searchAll("\\"))).toEqual([bs.id]);
    expect(ids(await searchAll("O'Brien"))).toEqual([quote.id]);
    expect(ids(await searchAll("'"))).toEqual([quote.id]);
    expect(ids(await searchAll('"hello"'))).toEqual([dq.id]);
  });

  it("does not treat % or _ alone as match-everything", async () => {
    await thoughts.create({ title: "첫째" });
    await thoughts.create({ title: "둘째" });
    expect(await searchAll("%")).toEqual([]);
    expect(await searchAll("_")).toEqual([]);
    expect(await searchAll("%%")).toEqual([]);
    expect(await searchAll("\\%")).toEqual([]);
  });

  it("survives injection-looking input and still works afterwards", async () => {
    const t = await thoughts.create({ title: "정상 글" });
    for (const q of ["'; DROP TABLE thoughts; --", "' OR '1'='1", "%' escape '", "\\' --"]) {
      expect(await searchAll(q)).toEqual([]);
    }
    expect(ids(await searchAll("정상"))).toEqual([t.id]);
  });

  it("matches wildcards inside highlights and notes literally", async () => {
    const p = await papers.create({ title: "논문" });
    const h = await addHighlight(p.id, 2, "성능이 95% 향상", "a_b 확인");
    await addHighlight(p.id, 3, "성능이 950 향상", "aXb 확인");
    expect(ids(await searchAll("95%"))).toEqual([h]);
    expect(ids(await searchAll("a_b"))).toEqual([h]);
  });
});

describe("very long queries", () => {
  it("does not throw on a huge query and caps it at MAX_QUERY_LENGTH", async () => {
    await thoughts.create({ title: "짧은 글" });
    expect(await searchAll("가".repeat(100_000))).toEqual([]);
  });

  it("matches on the first MAX_QUERY_LENGTH characters of an over-long query", async () => {
    const t = await thoughts.create({ title: "a".repeat(MAX_QUERY_LENGTH + 50) });
    expect(ids(await searchAll("a".repeat(MAX_QUERY_LENGTH + 500)))).toEqual([t.id]);
  });

  it("finds a title of exactly MAX_QUERY_LENGTH characters by its full text", async () => {
    const title = "b".repeat(MAX_QUERY_LENGTH);
    const t = await thoughts.create({ title });
    const [hit] = await searchAll(title);
    expect(hit.id).toBe(t.id);
    expect(hit.field).toBe("title");
  });

  it("does not split a surrogate pair when truncating the query", async () => {
    // "a" + emoji puts the 200-unit cut in the middle of a surrogate pair.
    const q = normalizeQuery(`a${"😀".repeat(150)}`);
    expect(q.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    expect(q).not.toMatch(LONE_SURROGATE);
    expect(q).toBe(`a${"😀".repeat(99)}`);
    const t = await thoughts.create({ title: `a${"😀".repeat(150)}` });
    expect(ids(await searchAll(`a${"😀".repeat(150)}`))).toEqual([t.id]);
  });
});

describe("ranking ties", () => {
  it("orders equal title scores by most recently updated, deterministically", async () => {
    const a = await thoughts.create({ title: "같은 제목" });
    const b = await thoughts.create({ title: "같은 제목" });
    const c = await thoughts.create({ title: "같은 제목" });
    await db
      .update(thoughtsTable)
      .set({ updatedAt: "2026-01-01T00:00:00.000Z" })
      .where(eq(thoughtsTable.id, a.id));
    await db
      .update(thoughtsTable)
      .set({ updatedAt: "2026-03-01T00:00:00.000Z" })
      .where(eq(thoughtsTable.id, b.id));
    await db
      .update(thoughtsTable)
      .set({ updatedAt: "2026-02-01T00:00:00.000Z" })
      .where(eq(thoughtsTable.id, c.id));
    const first = ids(await searchAll("같은 제목"));
    expect(first).toEqual([b.id, c.id, a.id]);
    expect(ids(await searchAll("같은 제목"))).toEqual(first);
  });

  it("keeps ties across types ordered by recency, not by type", async () => {
    const p = await papers.create({ title: "동률" });
    const t = await thoughts.create({ title: "동률" });
    await db
      .update(papersTable)
      .set({ updatedAt: "2026-05-01T00:00:00.000Z" })
      .where(eq(papersTable.id, p.id));
    await db
      .update(thoughtsTable)
      .set({ updatedAt: "2026-06-01T00:00:00.000Z" })
      .where(eq(thoughtsTable.id, t.id));
    expect(ids(await searchAll("동률"))).toEqual([t.id, p.id]);
  });

  it("ranks exact title above a newer prefix title, and title above body", async () => {
    const exact = await thoughts.create({ title: "검색" });
    const prefix = await thoughts.create({ title: "검색 엔진" });
    const body = await thoughts.create({ title: "무관", body: "검색 내용" });
    await db
      .update(thoughtsTable)
      .set({ updatedAt: "2020-01-01T00:00:00.000Z" })
      .where(eq(thoughtsTable.id, exact.id));
    expect(ids(await searchAll("검색"))).toEqual([exact.id, prefix.id, body.id]);
  });

  it("treats a title that differs only by case or surrounding spaces as exact", async () => {
    const exact = await thoughts.create({ title: "Attention" });
    const prefix = await thoughts.create({ title: "Attention Is All" });
    expect(ids(await searchAll("attention"))).toEqual([exact.id, prefix.id]);
  });
});

describe("highlights of deleted papers", () => {
  it("removes a deleted paper's highlights from search (cascade)", async () => {
    const keep = await papers.create({ title: "남는 논문" });
    const gone = await papers.create({ title: "지울 논문" });
    const hKeep = await addHighlight(keep.id, 1, "공통 문구 남음");
    await addHighlight(gone.id, 1, "공통 문구 사라짐", "공통 메모");
    expect((await searchAll("공통")).length).toBe(2);

    expect((await papers.remove(gone.id)).removed).toBe(true);

    expect(ids(await searchAll("공통"))).toEqual([hKeep]);
    expect(await db.select().from(highlights).where(eq(highlights.paperId, gone.id))).toEqual([]);
  });

  it("does not return highlights whose paper row is missing", async () => {
    // Even if a foreign key were not enforced, the join must hide orphans.
    const p = await papers.create({ title: "임시" });
    await addHighlight(p.id, 1, "고아 하이라이트");
    await papers.remove(p.id);
    expect(await searchAll("고아")).toEqual([]);
  });
});

describe("mixed types and limits", () => {
  async function seedMixed() {
    const r = await projects.create({ title: "혼합 프로젝트" });
    const s = await seminars.create({ title: "혼합 세미나" });
    const t = await thoughts.create({ title: "혼합 생각" });
    const p = await papers.create({ title: "혼합" });
    const h = await addHighlight(p.id, 4, "혼합 하이라이트");
    return { r, s, t, p, h };
  }

  it("returns all five kinds when the limit allows", async () => {
    const { r, s, t, p, h } = await seedMixed();
    const hits = await searchAll("혼합", { limit: 50 });
    expect(ids(hits).sort()).toEqual([r.id, s.id, t.id, p.id, h].sort());
    expect(new Set(hits.map((x) => x.type))).toEqual(
      new Set(["project", "seminar", "thought", "paper", "highlight"]),
    );
  });

  it("applies the limit after ranking across types, best first", async () => {
    const { p } = await seedMixed(); // paper "혼합" is the exact title match
    const one = await searchAll("혼합", { limit: 1 });
    expect(ids(one)).toEqual([p.id]);
    const three = await searchAll("혼합", { limit: 3 });
    expect(three).toHaveLength(3);
    expect(three[0].id).toBe(p.id);
    expect(three.map((x) => x.type)).not.toContain("highlight"); // lowest-ranked field
  });

  it.each([
    [0, 1],
    [-5, 1],
    ["2", 2],
    [2.9, 2],
    ["abc", 20],
    [undefined, 20],
    [Number.NaN, 20],
    [Infinity, 20],
  ])("limit %j yields %i results when many match", async (limit, expected) => {
    for (let i = 0; i < 30; i++) await thoughts.create({ title: `반복 항목 ${i}` });
    expect(await searchAll("반복", { limit: limit as number })).toHaveLength(expected);
  });

  it("never returns more than 50 results", async () => {
    for (let i = 0; i < 60; i++) await thoughts.create({ title: `대량 ${i}` });
    expect(await searchAll("대량", { limit: 1000 })).toHaveLength(50);
  });

  it("keeps an older title match when many newer body matches exist", async () => {
    const title = await thoughts.create({ title: "희귀어 제목" });
    await db
      .update(thoughtsTable)
      .set({ updatedAt: "2000-01-01T00:00:00.000Z" })
      .where(eq(thoughtsTable.id, title.id));
    for (let i = 0; i < 250; i++)
      await thoughts.create({ title: `잡음 ${i}`, body: "희귀어 포함 본문" });
    const hits = await searchAll("희귀어", { limit: 5 });
    expect(hits[0].id).toBe(title.id);
  });
});

describe("snippets and surrogate pairs", () => {
  const E = "😀";

  it("never cuts an emoji in half, wherever the window starts or ends", () => {
    for (let lead = 25; lead <= 45; lead++) {
      for (let trail = 55; trail <= 75; trail += 5) {
        const text = `${E.repeat(lead)}x찾기${E.repeat(trail)}`;
        const s = makeSnippet(text, "찾기")!;
        expect(s.match).toBe("찾기");
        for (const part of [s.before, s.after]) expect(part).not.toMatch(LONE_SURROGATE);
      }
    }
  });

  it("finds an emoji query and returns it whole", () => {
    const s = makeSnippet(`${"a".repeat(29)}${E}${"b".repeat(100)}`, E)!;
    expect(s.match).toBe(E);
    for (const part of [s.before, s.after]) expect(part).not.toMatch(LONE_SURROGATE);
  });

  it("keeps emoji intact in snippets returned by searchAll for bodies, notes and highlights", async () => {
    const text = `${E.repeat(35)}x검색어y${E.repeat(70)}`;
    await thoughts.create({ title: "본문", body: text });
    const p = await papers.create({ title: "논문" });
    await addHighlight(p.id, 1, text);
    await addHighlight(p.id, 2, "다른 문장", text);
    const hits = await searchAll("검색어");
    expect(hits.map((h) => h.field).sort()).toEqual(["body", "highlight", "note"]);
    for (const hit of hits) {
      expect(hit.snippet!.match).toBe("검색어");
      for (const part of [hit.snippet!.before, hit.snippet!.after]) {
        expect(part).not.toMatch(LONE_SURROGATE);
      }
    }
  });

  it("handles combining sequences and ZWJ emoji without throwing", () => {
    const family = "👨‍👩‍👧‍👦";
    const s = makeSnippet(`${family.repeat(20)}찾기${family.repeat(30)}`, "찾기")!;
    for (const part of [s.before, s.match, s.after]) expect(part).not.toMatch(LONE_SURROGATE);
  });
});
