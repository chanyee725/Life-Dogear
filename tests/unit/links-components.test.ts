import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ConnectedItems } from "@/components/links";
import { archive, areas, links, papers, seminars, thoughts } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";
import { itemPath } from "@/lib/item-path";

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
    expect(html).toMatch(/연결된 항목<span[^>]*>2<\/span>/);
    expect(html).toContain(`href="${itemPath("seminars", seminar.id, seminar.title)}"`);
    expect(html).toContain(`href="${itemPath("thoughts", thought.id, thought.title)}"`);
    expect(html).toContain(">활동<");
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
    expect(html).toContain(`href="${itemPath("areas", area.id, area.title)}"`);
    expect(html).toContain(">영역<");
    expect(html).toContain(">보관됨<");
  });

  it("shows only the add button when nothing is connected", async () => {
    const paper = await papers.create({ title: "혼자인 논문" });
    const html = await render({ type: "paper", id: paper.id });
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("아직 연결된 항목");
    expect(html).toContain("연결 추가");
  });
});

describe("ConnectedItems indirect (area)", () => {
  it("lists 2-step items with their path, no unlink, skipping area projects and direct links", async () => {
    const { projects, notes } = await import("@/lib/repo");
    const area = await areas.create({ title: "Robotics" });
    const A = { type: "area" as const, id: area.id };
    const project = await projects.create({ title: "MoveIt2", areaId: area.id });
    const Pr = { type: "project" as const, id: project.id };
    const note = await notes.create({ title: "Moveit 노트" });
    const direct = await papers.create({ title: "직접 논문" });
    const other = await projects.create({ title: "다른 프로젝트" });
    await links.link(Pr, { type: "note", id: note.id });
    await links.link(Pr, { type: "paper", id: direct.id });
    await links.link(A, { type: "paper", id: direct.id });
    await links.link({ type: "paper", id: direct.id }, { type: "project", id: other.id });

    const html = renderToStaticMarkup(await ConnectedItems({ item: A, indirect: true }));
    expect(html).toContain(`href="${itemPath("notes", note.id, note.title)}"`);
    expect(html).toContain(">MoveIt2<");
    expect(html).toContain(`href="${itemPath("projects", other.id, other.title)}"`);
    expect(html).toContain(">직접 논문<");
    // direct paper once (direct row only), area project not listed as indirect
    expect(
      html.match(new RegExp(`href="${itemPath("papers", direct.id, direct.title)}"`, "g"))?.length,
    ).toBe(1);
    expect(html).not.toContain(`href="${itemPath("projects", project.id, project.title)}"`);
    const plain = renderToStaticMarkup(await ConnectedItems({ item: A }));
    expect(plain).not.toContain("경유");
    // unlink buttons only on the single direct row
    expect(html.match(/연결 해제/g)?.length).toBe(plain.match(/연결 해제/g)?.length);
  });

  it("caps at 6, newest updatedAt first", async () => {
    const { projects } = await import("@/lib/repo");
    const area = await areas.create({ title: "영역" });
    const project = await projects.create({ title: "P", areaId: area.id });
    for (let i = 0; i < 8; i++) {
      const t = await thoughts.create({ title: `생각 ${i}` });
      await links.link({ type: "project", id: project.id }, { type: "thought", id: t.id });
      await new Promise((r) => setTimeout(r, 2));
    }
    const list = await areas.listIndirect(area.id);
    expect(list.map((x) => x.title)).toEqual([7, 6, 5, 4, 3, 2].map((i) => `생각 ${i}`));
  });
});
