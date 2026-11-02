import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ConnectedItems } from "@/components/links";
import { archive, areas, links, papers, seminars, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

beforeEach(async () => {
  await useFreshDb();
});

const render = async (item: Parameters<typeof ConnectedItems>[0]["item"]) =>
  renderToStaticMarkup(await ConnectedItems({ item }));

describe("ConnectedItems", () => {
  it("lists links from both directions with type badges and detail links", async () => {
    const paper = await papers.create({ title: "어텐션 논문" });
    const seminar = await seminars.create({ title: "세미나 A" });
    const thought = await thoughts.create({ title: "생각 <b>X</b>" });
    const P = { type: "paper" as const, id: paper.id };
    await links.link(P, { type: "seminar", id: seminar.id });
    await links.link({ type: "thought", id: thought.id }, P);

    const html = await render(P);
    expect(html).toContain('role="region" aria-label="연결된 항목"');
    expect(html).toMatch(/연결된 항목<span aria-hidden="true"[^>]*>2<\/span>/);
    expect(html).toContain(`href="/seminars/${seminar.id}"`);
    expect(html).toContain(`href="/thoughts/${thought.id}"`);
    expect(html).toContain(">세미나<");
    expect(html).toContain(">생각<");
    expect(html).toContain("생각 &lt;b&gt;X&lt;/b&gt;");
    expect(html.match(/연결 해제/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("연결 추가");
  });

  it("shows areas with their path and marks archived items", async () => {
    const paper = await papers.create({ title: "논문" });
    const area = await areas.create({ title: "학위" });
    const P = { type: "paper" as const, id: paper.id };
    await links.link(P, { type: "area", id: area.id });
    await archive.archive({ type: "area", id: area.id });
    const html = await render(P);
    expect(html).toContain(`href="/areas/${area.id}"`);
    expect(html).toContain(">영역<");
    expect(html).toContain(">보관됨<");
  });

  it("shows an empty message when nothing is connected", async () => {
    const paper = await papers.create({ title: "혼자인 논문" });
    const html = await render({ type: "paper", id: paper.id });
    expect(html).toContain("아직 연결된 항목이 없습니다");
    expect(html).toContain("연결 추가");
  });
});
