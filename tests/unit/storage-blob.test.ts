import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as imageRoute from "@/app/api/images/[name]/route";
import * as pdfRoute from "@/app/api/papers/[id]/pdf/route";
import { papers } from "@/lib/repo";
import {
  blobStore,
  blobStoreKind,
  BlobStoreError,
  FallbackBlobStore,
  LocalBlobStore,
  S3BlobStore,
  s3ConfigFromEnv,
  type S3Config,
} from "@/lib/storage/blob";
import { openImage, writeImage } from "@/lib/storage/images";
import { useFreshDb } from "./repo-helpers";

const CONFIG: S3Config = {
  endpoint: "https://acct.r2.example.com",
  bucket: "rb-files",
  accessKeyId: "AKIDTEST",
  secretAccessKey: "secret-test-key",
  region: "auto",
};
const ENV = {
  S3_ENDPOINT: CONFIG.endpoint,
  S3_BUCKET: CONFIG.bucket,
  S3_ACCESS_KEY_ID: CONFIG.accessKeyId,
  S3_SECRET_ACCESS_KEY: CONFIG.secretAccessKey,
};
const IMG = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** In-memory bucket answering the requests the store sends. */
function fakeBucket(initial: Record<string, string | Uint8Array> = {}) {
  const objects = new Map<string, Uint8Array>(
    Object.entries(initial).map(([k, v]) => [
      k,
      typeof v === "string" ? new TextEncoder().encode(v) : v,
    ]),
  );
  const requests: Request[] = [];
  let ignoreRange = false;
  const fetchImpl = vi.fn(async (request: Request) => {
    requests.push(request.clone());
    const url = new URL(request.url);
    const prefix = `/${CONFIG.bucket}/`;
    if (url.pathname === `/${CONFIG.bucket}` && request.method === "GET") {
      const p = url.searchParams.get("prefix") ?? "";
      const keys = [...objects.keys()].filter((k) => k.startsWith(p)).sort();
      const token = Number(url.searchParams.get("continuation-token") ?? 0);
      const page = keys.slice(token, token + 1);
      const more = token + 1 < keys.length;
      const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>${more}</IsTruncated>${
        more ? `<NextContinuationToken>${token + 1}</NextContinuationToken>` : ""
      }${page
        .map(
          (k) =>
            `<Contents><Key>${k}</Key><LastModified>2026-11-01T00:00:00.000Z</LastModified><Size>${objects.get(k)!.length}</Size></Contents>`,
        )
        .join("")}</ListBucketResult>`;
      return new Response(xml, { status: 200 });
    }
    const key = url.pathname.slice(prefix.length);
    const data = objects.get(key);
    switch (request.method) {
      case "PUT":
        objects.set(key, new Uint8Array(await request.arrayBuffer()));
        return new Response(null, { status: 200 });
      case "DELETE":
        objects.delete(key);
        return new Response(null, { status: 204 });
      case "HEAD":
        if (!data) return new Response(null, { status: 404 });
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(data.length),
            "last-modified": "Sun, 01 Nov 2026 00:00:00 GMT",
          },
        });
      case "GET": {
        if (!data) return new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
        const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.get("range") ?? "");
        if (range && !ignoreRange) {
          const [start, end] = [Number(range[1]), Number(range[2])];
          return new Response(data.slice(start, end + 1), {
            status: 206,
            headers: { "content-range": `bytes ${start}-${end}/${data.length}` },
          });
        }
        return new Response(data as Uint8Array<ArrayBuffer>, {
          status: 200,
          headers: { "content-length": String(data.length) },
        });
      }
    }
    return new Response(null, { status: 405 });
  });
  return {
    objects,
    requests,
    fetchImpl,
    store: new S3BlobStore(CONFIG, fetchImpl),
    ignoreRanges: () => {
      ignoreRange = true;
    },
  };
}

describe("s3ConfigFromEnv", () => {
  it("needs all four settings; region defaults to auto", () => {
    expect(s3ConfigFromEnv({})).toBeNull();
    expect(s3ConfigFromEnv({ ...ENV, S3_BUCKET: " " })).toBeNull();
    expect(s3ConfigFromEnv({ ...ENV, S3_ENDPOINT: `${CONFIG.endpoint}/` })).toEqual(CONFIG);
    expect(s3ConfigFromEnv({ ...ENV, S3_REGION: "us-east-1" })?.region).toBe("us-east-1");
    expect(blobStoreKind(ENV)).toBe("s3");
    expect(blobStoreKind({})).toBe("local");
  });
  it("BLOB_STORE=local forces local files", () => {
    expect(s3ConfigFromEnv({ ...ENV, BLOB_STORE: "local" })).toBeNull();
    expect(blobStore({}, { ...ENV, BLOB_STORE: "local" }).kind).toBe("local");
    expect(blobStore({}, ENV)).toBeInstanceOf(FallbackBlobStore);
  });
});

describe("S3BlobStore", () => {
  it("signs path-style requests with SigV4", async () => {
    const bucket = fakeBucket();
    await bucket.store.put(`images/${IMG}`, PNG, "image/png");
    const [request] = bucket.requests;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(`${CONFIG.endpoint}/${CONFIG.bucket}/images/${IMG}`);
    expect(request.headers.get("content-type")).toBe("image/png");
    expect(request.headers.get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDTEST\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
    );
    expect(request.headers.get("x-amz-date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(request.headers.get("x-amz-content-sha256")).toBe(
      createHash("sha256").update(PNG).digest("hex"),
    );
    expect(request.headers.get("authorization")).not.toContain(CONFIG.secretAccessKey);
    expect(bucket.objects.get(`images/${IMG}`)).toEqual(PNG);
  });

  it("forwards Range and reports the whole size", async () => {
    const bucket = fakeBucket({ "pdfs/seed-paper-1.pdf": "%PDF-1.7 abcdef" });
    const part = await bucket.store.get("pdfs/seed-paper-1.pdf", { start: 5, end: 7 });
    expect(bucket.requests[0].headers.get("range")).toBe("bytes=5-7");
    expect(part?.size).toBe(15);
    expect(part?.range).toEqual({ start: 5, end: 7 });
    expect(await new Response(part!.body).text()).toBe("1.7");
  });

  it("cuts the slice itself when the server ignores Range", async () => {
    const bucket = fakeBucket({ "pdfs/seed-paper-1.pdf": "%PDF-1.7 abcdef" });
    bucket.ignoreRanges();
    const part = await bucket.store.get("pdfs/seed-paper-1.pdf", { start: 9, end: 11 });
    expect(await new Response(part!.body).text()).toBe("abc");
  });

  it("returns null for missing files and false for missing deletes", async () => {
    const bucket = fakeBucket();
    expect(await bucket.store.get(`images/${IMG}`)).toBeNull();
    expect(await bucket.store.head(`images/${IMG}`)).toBeNull();
    expect(await bucket.store.delete(`images/${IMG}`)).toBe(false);
  });

  it("lists every page of a prefix", async () => {
    const bucket = fakeBucket({ "images/a.png": "1", "images/b.png": "22", "pdfs/c.pdf": "3" });
    const entries = await bucket.store.list("images/");
    expect(entries.map((e) => [e.key, e.size])).toEqual([
      ["images/a.png", 1],
      ["images/b.png", 2],
    ]);
    expect(entries[0].lastModified?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(bucket.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects odd keys before any request", async () => {
    const bucket = fakeBucket();
    for (const key of ["images/../local.db", "../x", "other/x.png", "images/", "images/a/b"]) {
      await expect(bucket.store.get(key)).rejects.toBeInstanceOf(BlobStoreError);
    }
    await expect(bucket.store.list("")).rejects.toBeInstanceOf(BlobStoreError);
    expect(bucket.fetchImpl).not.toHaveBeenCalled();
  });

  it("errors carry a status code but no endpoint, bucket or key", async () => {
    const store = new S3BlobStore(CONFIG, async () => new Response("denied", { status: 403 }));
    const error = await store.get(`images/${IMG}`).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlobStoreError);
    expect((error as BlobStoreError).code).toBe("s3_get_403");
    const text = `${(error as Error).message} ${(error as BlobStoreError).code}`;
    for (const secret of [CONFIG.endpoint, "r2.example", CONFIG.bucket, IMG, "AKIDTEST"]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("FallbackBlobStore", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "rb-blob-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads local files the bucket does not have yet", async () => {
    const bucket = fakeBucket();
    const local = new LocalBlobStore(root);
    await local.put(`images/${IMG}`, PNG);
    const store = new FallbackBlobStore(bucket.store, local);
    const image = await openImage(IMG, { store });
    expect(image?.size).toBe(PNG.length);
    expect(new Uint8Array(await new Response(image!.body).arrayBuffer())).toEqual(PNG);
    expect(bucket.requests.map((r) => r.method)).toEqual(["GET"]);
  });

  it("prefers the bucket, writes only there and deletes both copies", async () => {
    const bucket = fakeBucket({ [`images/${IMG}`]: "remote" });
    const local = new LocalBlobStore(root);
    await local.put(`images/${IMG}`, new TextEncoder().encode("local"));
    const store = new FallbackBlobStore(bucket.store, local);
    expect(await new Response((await store.get(`images/${IMG}`))!.body).text()).toBe("remote");

    const name = await writeImage(PNG, { store });
    expect(bucket.objects.has(`images/${name}`)).toBe(true);
    expect(await local.head(`images/${name}`)).toBeNull();

    expect((await store.list("images/")).map((e) => e.key).sort()).toEqual(
      [`images/${IMG}`, `images/${name}`].sort(),
    );
    expect(await store.delete(`images/${IMG}`)).toBe(true);
    expect(bucket.objects.has(`images/${IMG}`)).toBe(false);
    expect(await local.head(`images/${IMG}`)).toBeNull();
  });
});

describe("routes proxy the bucket", () => {
  const cwd = process.cwd();
  const saved = { ...process.env };
  let root = "";
  let bucket: ReturnType<typeof fakeBucket>;

  beforeAll(async () => {
    await useFreshDb();
    root = await mkdtemp(join(tmpdir(), "rb-blob-routes-"));
    process.chdir(root);
  });
  beforeEach(() => {
    bucket = fakeBucket();
    Object.assign(process.env, ENV);
    vi.stubGlobal("fetch", bucket.fetchImpl);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of Object.keys(ENV)) delete process.env[key];
    Object.assign(process.env, saved);
  });
  afterAll(async () => {
    process.chdir(cwd);
    await rm(root, { recursive: true, force: true });
  });

  it("serves a photo from the bucket, then from the local fallback", async () => {
    bucket.objects.set(`images/${IMG}`, PNG);
    const get = (name: string) =>
      imageRoute.GET(new Request(`http://localhost:3000/api/images/${name}`), {
        params: Promise.resolve({ name }),
      });
    const response = await get(IMG);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(PNG.length));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);

    const other = "0f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png";
    expect((await get(other)).status).toBe(404);
    await mkdir(join(root, "data/images"), { recursive: true });
    await writeFile(join(root, "data/images", other), PNG);
    expect((await get(other)).status).toBe(200);
    expect((await get("x.svg")).status).toBe(400);
  });

  it("uploads PDFs to the bucket and forwards Range requests", async () => {
    const { id } = await papers.create({ title: "R2 PDF" });
    const form = new FormData();
    form.append("file", new File(["%PDF-1.7 abcdef"], "p.pdf", { type: "application/pdf" }));
    const headers = {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    };
    const url = `http://localhost:3000/api/papers/${id}/pdf`;
    const ctx = { params: Promise.resolve({ id }) };
    const created = await pdfRoute.POST(
      new NextRequest(url, { method: "POST", body: form, headers }),
      ctx,
    );
    expect(created.status).toBe(201);
    expect(bucket.objects.has(`pdfs/${id}.pdf`)).toBe(true);
    await expect(readFile(join(root, "data/pdfs", `${id}.pdf`))).rejects.toThrow();

    bucket.requests.length = 0;
    const part = await pdfRoute.GET(
      new NextRequest(url, { headers: { host: "localhost:3000", range: "bytes=0-4" } }),
      ctx,
    );
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 0-4/15");
    expect(await part.text()).toBe("%PDF-");
    const get = bucket.requests.find((r) => r.method === "GET");
    expect(get?.headers.get("range")).toBe("bytes=0-4");

    const removed = await pdfRoute.DELETE(new NextRequest(url, { method: "DELETE", headers }), ctx);
    expect(removed.status).toBe(204);
    expect(bucket.objects.has(`pdfs/${id}.pdf`)).toBe(false);
  });
});
