import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as pdfRoute from "@/app/api/papers/[id]/pdf/route";
import * as progressRoute from "@/app/api/papers/[id]/progress/route";
import { papers } from "@/lib/repo";
import { useFreshDb } from "./repo-helpers";

const MISSING = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const HOST = { host: "localhost:3000" };
const SAME_ORIGIN = { ...HOST, origin: "http://localhost:3000", "sec-fetch-site": "same-origin" };
const CROSS_SITE = { ...HOST, origin: "http://evil.example", "sec-fetch-site": "cross-site" };

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const url = (id: string, path: "pdf" | "progress") =>
  `http://localhost:3000/api/papers/${id}/${path}`;

function upload(id: string, content: string, headers: Record<string, string> = SAME_ORIGIN) {
  const form = new FormData();
  form.append("file", new File([content], "paper.pdf", { type: "application/pdf" }));
  return pdfRoute.POST(
    new NextRequest(url(id, "pdf"), { method: "POST", body: form, headers }),
    ctx(id),
  );
}

function putProgress(id: string, body: unknown, headers: Record<string, string> = SAME_ORIGIN) {
  return progressRoute.PUT(
    new NextRequest(url(id, "progress"), {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { ...headers, "content-type": "application/json" },
    }),
    ctx(id),
  );
}

const get = (id: string, headers: Record<string, string> = HOST) =>
  pdfRoute.GET(new NextRequest(url(id, "pdf"), { headers }), ctx(id));

// Routes store files under `<cwd>/data/pdfs`, so run inside a temp directory.
const cwd = process.cwd();
let root = "";

beforeAll(async () => {
  await useFreshDb();
  root = await mkdtemp(join(tmpdir(), "rb-routes-"));
  process.chdir(root);
});

afterAll(async () => {
  process.chdir(cwd);
  await rm(root, { recursive: true, force: true });
});

describe("/api/papers/[id]/pdf", () => {
  it("uploads, streams with ranges and deletes", async () => {
    const { id } = await papers.create({ title: "PDF 흐름" });
    expect((await get(id)).status).toBe(404);

    expect((await upload(id, "<html>")).status).toBe(415);
    const created = await upload(id, "%PDF-1.7 abcdef");
    expect(created.status).toBe(201);
    expect((await papers.get(id))?.pdfPath).toBe(`data/pdfs/${id}.pdf`);

    const full = await get(id);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("application/pdf");
    expect(full.headers.get("content-security-policy")).toBe("sandbox");
    expect(await full.text()).toBe("%PDF-1.7 abcdef");

    const part = await get(id, { ...HOST, range: "bytes=0-4" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 0-4/15");
    expect(await part.text()).toBe("%PDF-");
    expect((await get(id, { ...HOST, range: "bytes=99-" })).status).toBe(416);

    const removed = await pdfRoute.DELETE(
      new NextRequest(url(id, "pdf"), { method: "DELETE", headers: SAME_ORIGIN }),
      ctx(id),
    );
    expect(removed.status).toBe(204);
    expect((await papers.get(id))?.pdfPath).toBeNull();
    expect((await get(id)).status).toBe(404);
  });

  it("validates ids and missing papers", async () => {
    expect((await get("../etc")).status).toBe(400);
    expect((await upload(MISSING, "%PDF-1.7")).status).toBe(404);
  });

  it("rejects cross-site uploads and deletes", async () => {
    const { id } = await papers.create({ title: "CSRF" });
    expect((await upload(id, "%PDF-1.7", CROSS_SITE)).status).toBe(403);
    expect(
      (await upload(id, "%PDF-1.7", { ...HOST, origin: "http://localhost:4000" })).status,
    ).toBe(403);
    expect((await papers.get(id))?.pdfPath).toBeNull();

    expect((await upload(id, "%PDF-1.7")).status).toBe(201);
    const removed = await pdfRoute.DELETE(
      new NextRequest(url(id, "pdf"), { method: "DELETE", headers: CROSS_SITE }),
      ctx(id),
    );
    expect(removed.status).toBe(403);
    expect((await papers.get(id))?.pdfPath).not.toBeNull();
  });
});

describe("/api/papers/[id]/progress", () => {
  it("saves positions from fetch and sendBeacon", async () => {
    const { id } = await papers.create({ title: "이어 읽기" });
    expect((await upload(id, "%PDF-1.7")).status).toBe(201);

    expect((await putProgress(id, { page: 3, scroll: 0.5, totalPages: 10 })).status).toBe(204);
    let paper = await papers.get(id);
    expect([paper?.lastPage, paper?.lastScroll, paper?.totalPages, paper?.readStatus]).toEqual([
      3,
      0.5,
      10,
      "reading",
    ]);

    const beacon = await progressRoute.POST(
      new NextRequest(url(id, "progress"), {
        method: "POST",
        body: JSON.stringify({ page: 4, scroll: 0.1, totalPages: 10 }),
        headers: { ...SAME_ORIGIN, "content-type": "text/plain;charset=UTF-8" },
      }),
      ctx(id),
    );
    expect(beacon.status).toBe(204);
    paper = await papers.get(id);
    expect(paper?.lastPage).toBe(4);
  });

  it("rejects invalid bodies, missing papers and papers without a PDF", async () => {
    const { id } = await papers.create({ title: "PDF 없음" });
    expect((await putProgress(id, "{}")).status).toBe(400);
    expect((await putProgress(id, { page: 1, scroll: 0 })).status).toBe(404);
    expect((await papers.get(id))?.lastPage).toBeNull();
    expect((await putProgress(MISSING, { page: 1, scroll: 0 })).status).toBe(404);
  });

  it("rejects cross-site writes", async () => {
    const { id } = await papers.create({ title: "CSRF 진행" });
    expect((await upload(id, "%PDF-1.7")).status).toBe(201);
    expect((await putProgress(id, { page: 2, scroll: 0 }, CROSS_SITE)).status).toBe(403);
    expect((await papers.get(id))?.lastPage).toBeNull();
  });
});
