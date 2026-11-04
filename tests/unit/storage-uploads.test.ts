import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertKey,
  isPendingKey,
  LocalBlobStore,
  newPendingKey,
  S3BlobStore,
} from "@/lib/storage/blob";
import { gcPending } from "@/lib/storage/maintenance";
import {
  finalizeUpload,
  parseConfirmInput,
  parseSignInput,
  signUpload,
  UploadError,
} from "@/lib/storage/uploads";
import { CONFIG, fakeBucket, PNG } from "./storage-fake-bucket";

const PAPER = "7d1e2f30-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const NOW = new Date("2026-11-04T09:00:00.000Z");

/**
 * Independent SigV4 query-signature check (AWS docs, "Authenticating requests: query
 * parameters"), so the test does not trust aws4fetch to verify itself.
 */
function verifyPresigned(url: string, method: string, headers: Record<string, string>) {
  const u = new URL(url);
  const params = [...u.searchParams.entries()].filter(([k]) => k !== "X-Amz-Signature");
  const enc = (s: string) =>
    encodeURIComponent(s).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  const query = params
    .map(([k, v]) => [enc(k), enc(v)])
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : 1))
    .map((p) => p.join("="))
    .join("&");
  const signed = u.searchParams.get("X-Amz-SignedHeaders")!.split(";");
  const all: Record<string, string> = { host: u.host, ...headers };
  const canonicalHeaders = signed.map((h) => `${h}:${all[h]}\n`).join("");
  const canonical = [
    method,
    u.pathname,
    query,
    canonicalHeaders,
    signed.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const date = u.searchParams.get("X-Amz-Date")!;
  const scope = `${date.slice(0, 8)}/${CONFIG.region}/s3/aws4_request`;
  const toSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");
  let key: Buffer = createHmac("sha256", `AWS4${CONFIG.secretAccessKey}`)
    .update(date.slice(0, 8))
    .digest();
  for (const part of [CONFIG.region, "s3", "aws4_request"]) {
    key = createHmac("sha256", key).update(part).digest();
  }
  return (
    createHmac("sha256", key).update(toSign).digest("hex") === u.searchParams.get("X-Amz-Signature")
  );
}

describe("pending keys", () => {
  it("accepts only pending/<uuid>", () => {
    const key = newPendingKey();
    expect(isPendingKey(key)).toBe(true);
    expect(() => assertKey(key)).not.toThrow();
    for (const bad of ["pending/x", "pending/../images/a.png", "pending/", 3, "images/a.png"]) {
      expect(isPendingKey(bad)).toBe(false);
    }
    expect(() => assertKey("pending/abc")).toThrow();
  });
});

describe("S3BlobStore.presign", () => {
  const store = new S3BlobStore(CONFIG, async () => new Response(null));

  it("signs a 5-minute PUT bound to content type and length", async () => {
    const url = await store.presign("pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b", {
      method: "PUT",
      contentType: "image/png",
      contentLength: 1234,
      now: NOW,
    });
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(
      `${CONFIG.endpoint}/${CONFIG.bucket}/pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b`,
    );
    expect(u.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(u.searchParams.get("X-Amz-Date")).toBe("20261104T090000Z");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(u.searchParams.get("X-Amz-Credential")).toBe(
      `${CONFIG.accessKeyId}/20261104/auto/s3/aws4_request`,
    );
    expect(url).not.toContain(CONFIG.secretAccessKey);
    const headers = { "content-type": "image/png", "content-length": "1234" };
    expect(verifyPresigned(url, "PUT", headers)).toBe(true);
    // A different type or size does not match the signature.
    expect(verifyPresigned(url, "PUT", { ...headers, "content-length": "99999" })).toBe(false);
    expect(verifyPresigned(url, "PUT", { ...headers, "content-type": "image/svg+xml" })).toBe(
      false,
    );
  });

  it("signs a GET that fixes the response headers", async () => {
    const url = await store.presign("pdfs/x.pdf", {
      method: "GET",
      response: {
        contentType: "application/pdf",
        contentDisposition: "inline",
        cacheControl: "private, no-cache",
      },
      now: NOW,
    });
    const u = new URL(url);
    expect(u.searchParams.get("response-content-type")).toBe("application/pdf");
    expect(u.searchParams.get("response-content-disposition")).toBe("inline");
    expect(u.searchParams.get("response-cache-control")).toBe("private, no-cache");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(verifyPresigned(url, "GET", {})).toBe(true);
    // Tampering with an override breaks the signature.
    u.searchParams.set("response-content-type", "text/html");
    expect(verifyPresigned(u.toString(), "GET", {})).toBe(false);
  });

  it("rejects odd keys, PUTs without type or size and long expiries", async () => {
    await expect(store.presign("../x", { method: "GET" })).rejects.toThrow();
    await expect(store.presign("images/a.png", { method: "PUT" })).rejects.toThrow();
    await expect(
      store.presign("images/a.png", { method: "GET", expiresIn: 86400 }),
    ).rejects.toThrow();
  });
});

describe("S3BlobStore.copy", () => {
  it("copies inside the bucket with a new content type", async () => {
    const bucket = fakeBucket({ "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b": PNG });
    await bucket.store.copy(
      "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
      "images/a.png",
      "image/png",
    );
    expect(bucket.objects.get("images/a.png")).toEqual(PNG);
    expect(bucket.types.get("images/a.png")).toBe("image/png");
    const request = bucket.requests.at(-1)!;
    expect(request.headers.get("x-amz-copy-source")).toBe(
      `/${CONFIG.bucket}/pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b`,
    );
    expect(request.headers.get("authorization")).toMatch(/x-amz-copy-source/);
  });

  it("treats a 200 with an error document as a failure", async () => {
    const store = new S3BlobStore(
      CONFIG,
      async () => new Response("<Error><Code>InternalError</Code></Error>"),
    );
    await expect(store.copy("images/a.png", "images/b.png", "image/png")).rejects.toThrow(
      expect.objectContaining({ code: "s3_copy_error" }),
    );
  });
});

describe("parseSignInput", () => {
  const status = (body: unknown) => {
    try {
      parseSignInput(body);
      return 0;
    } catch (error) {
      return (error as UploadError).status;
    }
  };
  it("accepts raster photos and PDFs with a paper id", () => {
    expect(parseSignInput({ kind: "image", size: 10, contentType: "IMAGE/PNG" })).toEqual({
      kind: "image",
      size: 10,
      contentType: "image/png",
    });
    expect(
      parseSignInput({ kind: "pdf", size: 10, contentType: "application/pdf", target: PAPER }),
    ).toEqual({ kind: "pdf", size: 10, contentType: "application/pdf", target: PAPER });
  });
  it("rejects SVG, HEIC, wrong types, bad sizes and bad ids", () => {
    expect(status({ kind: "image", size: 10, contentType: "image/svg+xml" })).toBe(415);
    expect(status({ kind: "image", size: 10, contentType: "image/heic" })).toBe(415);
    expect(status({ kind: "image", size: 21 * 1024 * 1024, contentType: "image/png" })).toBe(413);
    expect(status({ kind: "image", size: 0, contentType: "image/png" })).toBe(400);
    expect(status({ kind: "image", size: 1.5, contentType: "image/png" })).toBe(400);
    expect(status({ kind: "pdf", size: 10, contentType: "text/html", target: PAPER })).toBe(415);
    expect(
      status({
        kind: "pdf",
        size: 101 * 1024 * 1024,
        contentType: "application/pdf",
        target: PAPER,
      }),
    ).toBe(413);
    expect(status({ kind: "pdf", size: 10, contentType: "application/pdf", target: "../x" })).toBe(
      400,
    );
    expect(status({ kind: "zip", size: 10, contentType: "application/zip" })).toBe(400);
    expect(status(null)).toBe(400);
  });
});

describe("signUpload", () => {
  it("returns a presigned PUT for a fresh pending key", async () => {
    const store = new S3BlobStore(CONFIG, async () => new Response(null));
    const signed = await signUpload(store, { kind: "image", size: 11, contentType: "image/png" });
    expect(isPendingKey(signed.key)).toBe(true);
    expect(signed).toMatchObject({ mode: "s3", method: "PUT", expiresIn: 300 });
    expect(signed.headers).toEqual({ "Content-Type": "image/png" });
    expect(new URL(signed.url).pathname).toBe(`/${CONFIG.bucket}/${signed.key}`);
  });
});

describe("finalizeUpload", () => {
  const KEY = "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
  const enc = (s: string) => new TextEncoder().encode(s);

  it("parses confirm bodies", () => {
    expect(parseConfirmInput({ kind: "image", key: KEY })).toEqual({ kind: "image", key: KEY });
    expect(() => parseConfirmInput({ kind: "image", key: "images/a.png" })).toThrow(UploadError);
    expect(() => parseConfirmInput({ kind: "pdf", key: KEY })).toThrow(UploadError);
  });

  it("copies a checked photo to a new name and deletes the temporary object", async () => {
    const bucket = fakeBucket({ [KEY]: PNG });
    const done = await finalizeUpload(bucket.store, { kind: "image", key: KEY });
    expect(done.kind).toBe("image");
    const name = done.key.slice("images/".length);
    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(done).toMatchObject({ url: `/api/images/${name}` });
    expect(bucket.objects.get(done.key)).toEqual(PNG);
    expect(bucket.types.get(done.key)).toBe("image/png");
    expect(bucket.objects.has(KEY)).toBe(false);
    // Only the first bytes are read back.
    const get = bucket.requests.find((r) => r.method === "GET")!;
    expect(get.headers.get("range")).toBe("bytes=0-15");
  });

  it("copies a PDF over the paper's file", async () => {
    const bucket = fakeBucket({ [KEY]: "%PDF-1.7 new", [`pdfs/${PAPER}.pdf`]: "%PDF-1.4 old" });
    const done = await finalizeUpload(bucket.store, { kind: "pdf", key: KEY, target: PAPER });
    expect(done).toEqual({ kind: "pdf", key: `pdfs/${PAPER}.pdf` });
    expect(new TextDecoder().decode(bucket.objects.get(done.key))).toBe("%PDF-1.7 new");
    expect(bucket.types.get(done.key)).toBe("application/pdf");
    expect(bucket.objects.has(KEY)).toBe(false);
  });

  it.each([
    ["SVG as a photo", "image", '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 415],
    [
      "HEIC as a photo",
      "image",
      new Uint8Array([0, 0, 0, 24, ...enc("ftypheic"), 0, 0, 0, 0]),
      415,
    ],
    ["HTML as a PDF", "pdf", "<html><script>alert(1)</script>", 415],
    ["an empty file", "pdf", "", 400],
  ] as const)("rejects %s and deletes it", async (_label, kind, bytes, expected) => {
    const bucket = fakeBucket({ [KEY]: bytes });
    const input = kind === "pdf" ? { kind, key: KEY, target: PAPER } : { kind, key: KEY };
    await expect(finalizeUpload(bucket.store, input)).rejects.toMatchObject({ status: expected });
    expect([...bucket.objects.keys()]).toEqual([]);
  });

  it("rejects a file larger than the limit and deletes it", async () => {
    const bucket = fakeBucket({ [KEY]: new Uint8Array(20 * 1024 * 1024 + 1).fill(0xff) });
    await expect(finalizeUpload(bucket.store, { kind: "image", key: KEY })).rejects.toMatchObject({
      status: 413,
    });
    expect(bucket.objects.size).toBe(0);
  });

  it("404s when nothing was uploaded", async () => {
    const bucket = fakeBucket();
    await expect(finalizeUpload(bucket.store, { kind: "image", key: KEY })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("deletes the temporary object when the copy fails", async () => {
    const bucket = fakeBucket({ [KEY]: PNG });
    const failing = new S3BlobStore(CONFIG, async (request) =>
      request.headers.get("x-amz-copy-source")
        ? new Response(null, { status: 500 })
        : bucket.fetchImpl(request),
    );
    await expect(finalizeUpload(failing, { kind: "image", key: KEY })).rejects.toThrow();
    expect(bucket.objects.size).toBe(0);
  });
});

describe("gcPending", () => {
  it("deletes only pending objects older than an hour, and only with apply", async () => {
    // fakeBucket reports every object as last modified 2026-11-01.
    const bucket = fakeBucket({
      "pending/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b": PNG,
      "images/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png": PNG,
    });
    expect(await gcPending(bucket.store, { now: NOW })).toEqual({
      total: 1,
      stale: 1,
      deleted: 0,
      failed: 0,
    });
    expect(bucket.objects.size).toBe(2);
    const fresh = await gcPending(bucket.store, {
      apply: true,
      now: new Date("2026-11-01T00:30:00Z"),
    });
    expect(fresh).toMatchObject({ stale: 0, deleted: 0 });
    expect(await gcPending(bucket.store, { apply: true, now: NOW })).toMatchObject({ deleted: 1 });
    expect([...bucket.objects.keys()]).toEqual(["images/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png"]);
  });

  it("works on a local folder without pending files", async () => {
    expect(await gcPending(new LocalBlobStore("/nonexistent-rb-root"))).toMatchObject({ total: 0 });
  });
});
