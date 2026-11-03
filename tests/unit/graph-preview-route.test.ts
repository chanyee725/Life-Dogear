import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/graph/preview/route";
import type { NodePreview } from "@/components/graph/preview-types";
import { archive, areas, goals, papers, projects } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { useFreshDb } from "./repo-helpers";

const HOST = { host: "localhost:3000" };
const CROSS_SITE = { ...HOST, origin: "http://evil.example", "sec-fetch-site": "cross-site" };

const get = (node: string, headers: Record<string, string> = HOST) =>
  GET(
    new NextRequest(`http://localhost:3000/graph/preview?${new URLSearchParams({ node })}`, {
      headers,
    }),
  );

beforeEach(async () => {
  await useFreshDb();
});

describe("GET /graph/preview", () => {
  it("rejects cross-site requests and malformed ids", async () => {
    const paper = await papers.create({ title: "논문" });
    expect((await get(`paper:${paper.id}`, CROSS_SITE)).status).toBe(403);
    expect((await get("paper:../x")).status).toBe(400);
    expect((await get("nope:1")).status).toBe(400);
  });

  it("returns 404 for a missing item and no-store details for an existing one", async () => {
    expect((await get("paper:seed-missing")).status).toBe(404);
    const paper = await papers.create({ title: "논문", year: 2024 });
    const res = await get(`paper:${paper.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as NodePreview;
    expect(body.props).toContainEqual({ label: "연도", value: "2024" });
  });

  it("includes goal progress, parent and period; 404 for a missing goal", async () => {
    const life = await goals.create({ title: "좋은 연구자", horizon: "life" });
    const year = await goals.create({
      title: "1저자 논문",
      horizon: "year",
      period: "2027",
      parentId: life.id,
      progressMode: "manual",
      manualProgress: 30,
    });
    const body = (await (await get(`goal:${year.id}`)).json()) as NodePreview;
    expect(body.badge).toBe("연 목표 2027");
    expect(body.props).toEqual([
      { label: "진행률", value: "30%" },
      { label: "기간", value: "2027" },
      { label: "상위", value: "좋은 연구자" },
    ]);
    expect((await get("goal:seed-missing")).status).toBe(404);
  });

  it("counts an area's projects like the area page, goal-reached ones included", async () => {
    const area = await areas.create({ title: "연구" });
    const other = await areas.create({ title: "건강" });
    const life = await goals.create({ title: "인생", horizon: "life", areaId: area.id });
    const year = await goals.create({
      title: "연(상속)",
      horizon: "year",
      period: "2027",
      parentId: life.id,
    });
    await projects.create({ title: "영역 프로젝트", areaId: area.id });
    await projects.create({ title: "목표 경유 프로젝트", goalId: year.id });
    await projects.create({ title: "다른 영역", areaId: other.id, goalId: year.id });
    const shelved = await projects.create({ title: "보관 프로젝트", areaId: area.id });
    await archive.archive({ type: "project", id: shelved.id });
    const count = async () => ((await (await get(`area:${area.id}`)).json()) as NodePreview).props;
    expect(await count()).toEqual([{ label: "프로젝트", value: "2개" }]);
    // An archived area also counts its archived projects.
    await archive.archive({ type: "area", id: area.id });
    expect(await count()).toEqual([{ label: "프로젝트", value: "3개" }]);
  });

  it("includes the review period and state; 404 for a missing review", async () => {
    const { review } = await reviews.open("week", "2026-W45");
    const body = (await (await get(`review:${review.id}`)).json()) as NodePreview;
    expect(body.badge).toBe("주간 회고");
    expect(body.props).toContainEqual({ label: "상태", value: "작성 중" });
    expect((await get("review:seed-missing")).status).toBe(404);
  });
});
