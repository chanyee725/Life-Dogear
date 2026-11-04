import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as confirmRoute from "@/app/api/uploads/confirm/route";
import * as signRoute from "@/app/api/uploads/sign/route";
import { papers } from "@/lib/repo";
import { CONFIG, ENV, fakeBucket, PNG } from "./storage-fake-bucket";
import { useFreshDb } from "./repo-helpers";
import { issueUploadToken, uploadTokenKey } from "@/lib/storage/upload-token";

const tokenFor = (claims: { key: string; kind: "image" | "pdf"; target?: string; size: number }) =>
  issueUploadToken(uploadTokenKey(CONFIG.secretAccessKey), { ...claims, exp: Date.now() + 60_000 });

const ORIGIN = "http://localhost:3000";
const SAME = { host: "localhost:3000", origin: ORIGIN, "sec-fetch-site": "same-origin" };

const post = (route: typeof signRoute | typeof confirmRoute, body: unknown, headers = SAME) =>
  route.POST(
    new NextRequest(`${ORIGIN}/api/uploads/x`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { ...headers, "content-type": "application/json" },
    }),
  );

describe("/api/uploads", () => {
  const saved = { ...process.env };
  let bucket: ReturnType<typeof fakeBucket>;

  beforeAll(async () => {
    await useFreshDb();
  });
  beforeEach(() => {
    bucket = fakeBucket();
    Object.assign(process.env, ENV);
    delete process.env.BLOB_STORE;
    vi.stubGlobal("fetch", bucket.fetchImpl);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(ENV)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it("tells the browser to use the regular routes in local mode", async () => {
    process.env.BLOB_STORE = "local";
    const res = await post(signRoute, { kind: "image", size: 10, contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "local" });
    const confirm = await post(confirmRoute, {
      kind: "image",
      key: "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
    });
    expect(confirm.status).toBe(409);
    expect(bucket.requests).toEqual([]);
  });

  it("rejects cross-site requests", async () => {
    const cross = { ...SAME, origin: "https://evil.example", "sec-fetch-site": "cross-site" };
    expect((await post(signRoute, {}, cross)).status).toBe(403);
    expect((await post(confirmRoute, {}, cross)).status).toBe(403);
  });

  it("signs, accepts the upload and confirms a photo", async () => {
    const res = await post(signRoute, {
      kind: "image",
      size: PNG.length,
      contentType: "image/png",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const signed = (await res.json()) as { key: string; url: string; token: string };
    expect(signed.key).toMatch(/^pending\//);
    expect(new URL(signed.url).pathname).toBe(`/${CONFIG.bucket}/${signed.key}`);
    expect(signed.url).not.toContain(CONFIG.secretAccessKey);
    expect(bucket.requests).toEqual([]); // signing needs no network

    // The browser's PUT, simulated.
    bucket.objects.set(signed.key, PNG);
    const done = await post(confirmRoute, { token: signed.token });
    expect(done.status).toBe(201);
    const { url } = (await done.json()) as { url: string };
    const name = url.slice("/api/images/".length);
    expect(bucket.objects.get(`images/${name}`)).toEqual(PNG);
    expect(bucket.objects.has(signed.key)).toBe(false);
  });

  it("rejects SVG at signing and an SVG body at confirming", async () => {
    const svg = await post(signRoute, { kind: "image", size: 10, contentType: "image/svg+xml" });
    expect(svg.status).toBe(415);
    const key = "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
    bucket.objects.set(key, new TextEncoder().encode("<svg onload=alert(1)>"));
    const res = await post(confirmRoute, { token: tokenFor({ key, kind: "image", size: 21 }) });
    expect(res.status).toBe(415);
    expect(bucket.objects.size).toBe(0);
  });

  it("attaches a confirmed PDF to its paper", async () => {
    const { id } = await papers.create({ title: "Direct upload" });
    const pdf = new TextEncoder().encode("%PDF-1.7 direct");
    const res = await post(signRoute, {
      kind: "pdf",
      size: pdf.length,
      contentType: "application/pdf",
      target: id,
    });
    const { key, token } = (await res.json()) as { key: string; token: string };
    bucket.objects.set(key, pdf);
    const done = await post(confirmRoute, { token });
    expect(done.status).toBe(201);
    const { pdfPath } = (await done.json()) as { pdfPath: string };
    expect(pdfPath).toMatch(new RegExp(`/pdfs/${id}\\.pdf$`));
    expect((await papers.get(id))?.pdfPath).toBe(pdfPath);
    expect(bucket.objects.get(`pdfs/${id}.pdf`)).toEqual(pdf);
    expect(bucket.objects.has(key)).toBe(false);
  });

  it("404s for an unknown paper and drops its temporary object", async () => {
    const missing = "7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
    const sign = await post(signRoute, {
      kind: "pdf",
      size: 10,
      contentType: "application/pdf",
      target: missing,
    });
    expect(sign.status).toBe(404);
    const key = "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
    bucket.objects.set(key, new TextEncoder().encode("%PDF-1.7"));
    const res = await post(confirmRoute, {
      token: tokenFor({ key, kind: "pdf", target: missing, size: 8 }),
    });
    expect(res.status).toBe(404);
    expect(bucket.objects.size).toBe(0);
  });

  it("rejects malformed bodies", async () => {
    expect((await post(signRoute, "not json")).status).toBe(400);
    expect((await post(signRoute, "x".repeat(5000))).status).toBe(400);
    expect((await post(confirmRoute, { kind: "image", key: "images/a.png" })).status).toBe(400);
    // A token cannot be redirected to another paper.
    const { id } = await papers.create({ title: "Other" });
    const key = "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
    const token = tokenFor({ key, kind: "pdf", target: id, size: 8 });
    const forged = `${Buffer.from(JSON.stringify({ key, kind: "pdf", target: "seed-x", size: 8, exp: Date.now() + 60_000 })).toString("base64url")}.${token.split(".")[1]}`;
    expect((await post(confirmRoute, { token: forged })).status).toBe(400);
  });

  it("logs bucket failures without URLs, keys or endpoints", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
    const key = "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
    const res = await post(confirmRoute, { token: tokenFor({ key, kind: "image", size: 11 }) });
    expect(res.status).toBe(500);
    const printed = log.mock.calls.flat().join(" ");
    expect(printed).not.toContain(CONFIG.endpoint);
    expect(printed).not.toContain(key);
    expect(printed).not.toContain(CONFIG.accessKeyId);
  });
});
