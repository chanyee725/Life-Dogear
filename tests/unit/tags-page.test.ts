import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  },
}));
import TagPage from "@/app/tags/[name]/page";
import TagsPage from "@/app/tags/page";
import { decodeTagParam, loadTagPage, sortTags, tagHref } from "@/app/tags/tag-data";
import { papers, projects, seminars, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

describe("tag helpers", () => {
  it("sorts by count then name, or by name", () => {
    const list = [
      { name: "나", count: 1 },
      { name: "가", count: 1 },
      { name: "다", count: 3 },
    ];
    expect(sortTags(list, "count").map((t) => t.name)).toEqual(["다", "가", "나"]);
    expect(sortTags(list, "name").map((t) => t.name)).toEqual(["가", "나", "다"]);
  });

  it("round-trips names through the URL and rejects bad encoding", () => {
    expect(tagHref("질적 연구/방법")).toBe(
      "/tags/%EC%A7%88%EC%A0%81%20%EC%97%B0%EA%B5%AC%2F%EB%B0%A9%EB%B2%95",
    );
    expect(decodeTagParam(tagHref("질적 연구/방법").slice(6))).toBe("질적 연구/방법");
    expect(decodeTagParam("%E0%A4%A")).toBeNull();
    expect(decodeTagParam("%20")).toBeNull();
    expect(decodeTagParam(encodeURIComponent("방법론".normalize("NFD")))).toBe("방법론");
  });
});

describe("loadTagPage", () => {
  it("groups tagged items by type, hides empty groups and matches case-insensitively", async () => {
    await projects.create({ title: "연구 A", stage: "drafting", tags: ["NLP"] });
    await papers.create({
      title: "논문 A",
      authors: ["김가명"],
      year: 2024,
      readStatus: "reading",
      tags: ["nlp"],
    });
    await thoughts.create({ title: "생각 A", kind: "idea", tags: ["NLP"] });
    await seminars.create({ title: "다른 세미나", tags: ["기타"] });

    const data = (await loadTagPage("nlp"))!;
    expect(data.name).toBe("NLP");
    expect(data.total).toBe(3);
    expect(data.groups.map((g) => g.type)).toEqual(["project", "paper", "thought"]);
    expect(data.groups[1].items[0]).toMatchObject({
      title: "논문 A",
      meta: "김가명 · 2024",
      badges: [
        { label: "읽는 중", tone: "blue" },
        { label: "참고", tone: "blue" },
      ],
    });
    expect(await loadTagPage("없는태그")).toBeNull();
  });
});

describe("tag pages", () => {
  it("lists tags with counts and links, or an empty state", async () => {
    const empty = renderToStaticMarkup(await TagsPage({ searchParams: Promise.resolve({}) }));
    expect(empty).toContain("아직 태그가 없습니다");

    await thoughts.create({ title: "T", tags: ["방법론", "NLP"] });
    await papers.create({ title: "P", tags: ["NLP"] });
    const html = renderToStaticMarkup(
      await TagsPage({ searchParams: Promise.resolve({ sort: "name" }) }),
    );
    expect(html).toContain(`href="${tagHref("NLP")}"`);
    expect(html).toContain("#방법론");
    expect(html).toContain("2개");
    // Korean collation puts Hangul before Latin.
    expect(html.indexOf("#방법론")).toBeLessThan(html.indexOf("#NLP"));
  });

  it("renders a tag detail page and 404s for unknown tags", async () => {
    const p = await papers.create({ title: "논문 <X>", tags: ["질적 연구"] });
    const html = renderToStaticMarkup(
      await TagPage({ params: Promise.resolve({ name: encodeURIComponent("질적 연구") }) }),
    );
    expect(html).toContain("#질적 연구");
    expect(html).toContain(`href="/papers/${p.id}"`);
    expect(html).toContain("논문 &lt;X&gt;");
    expect(html).not.toContain(">연구<span");
    await expect(TagPage({ params: Promise.resolve({ name: "nope" }) })).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
