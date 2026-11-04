import { beforeEach, describe, expect, it, vi } from "vitest";
import { directUpload, resetDirectUploadMode } from "@/lib/storage/direct-upload";

const BUCKET_URL = "https://bucket.example/rb/pending/x?X-Amz-Signature=abc";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Call = { url: string; init?: RequestInit };

function fakeServer(
  handlers: Record<string, (init?: RequestInit) => Response | Promise<Response>>,
) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const handler = handlers[url.startsWith("https://bucket.example") ? "PUT" : url];
    if (!handler) throw new TypeError("network");
    return handler(init);
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const FILE = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
const SIGNED = {
  mode: "s3",
  key: "pending/k",
  url: BUCKET_URL,
  method: "PUT",
  headers: { "Content-Type": "image/png" },
  expiresIn: 300,
  token: "tok.sig",
};

describe("directUpload", () => {
  beforeEach(() => resetDirectUploadMode());

  it("signs, PUTs to the bucket and confirms with the token", async () => {
    const server = fakeServer({
      "/api/uploads/sign": () => json(SIGNED),
      PUT: () => new Response(null, { status: 200 }),
      "/api/uploads/confirm": () => json({ url: "/api/images/a.png" }, 201),
    });
    const result = await directUpload(
      { kind: "image", file: FILE, contentType: "image/png" },
      "사진을 올리지 못했습니다.",
      server.fetchImpl,
    );
    expect(result).toEqual({ mode: "s3", data: { url: "/api/images/a.png" } });
    expect(server.calls.map((c) => c.url)).toEqual([
      "/api/uploads/sign",
      BUCKET_URL,
      "/api/uploads/confirm",
    ]);
    expect(JSON.parse(String(server.calls[0].init?.body))).toEqual({
      kind: "image",
      size: 4,
      contentType: "image/png",
    });
    const put = server.calls[1].init!;
    expect(put.method).toBe("PUT");
    expect(put.headers).toEqual({ "Content-Type": "image/png" });
    expect(put.body).toBe(FILE);
    expect(JSON.parse(String(server.calls[2].init?.body))).toEqual({ token: "tok.sig" });
  });

  it("sends the paper id for PDFs", async () => {
    const server = fakeServer({
      "/api/uploads/sign": () =>
        json({ ...SIGNED, headers: { "Content-Type": "application/pdf" } }),
      PUT: () => new Response(null),
      "/api/uploads/confirm": () => json({ pdfPath: "data/pdfs/p.pdf" }, 201),
    });
    const result = await directUpload(
      { kind: "pdf", file: FILE, contentType: "application/pdf", target: "seed-p" },
      "PDF를 올리지 못했습니다.",
      server.fetchImpl,
    );
    expect(result).toMatchObject({ mode: "s3", data: { pdfPath: "data/pdfs/p.pdf" } });
    expect(JSON.parse(String(server.calls[0].init?.body)).target).toBe("seed-p");
  });

  it("reports local mode once and remembers it", async () => {
    const server = fakeServer({ "/api/uploads/sign": () => json({ mode: "local" }) });
    const req = { kind: "image" as const, file: FILE, contentType: "image/png" };
    expect(await directUpload(req, "x", server.fetchImpl)).toEqual({ mode: "local" });
    expect(await directUpload(req, "x", server.fetchImpl)).toEqual({ mode: "local" });
    expect(server.calls).toHaveLength(1);
  });

  it("shows the server's message when signing or confirming is refused", async () => {
    const refused = fakeServer({
      "/api/uploads/sign": () => json({ error: "HEIC 사진은 안 됩니다." }, 415),
    });
    const req = { kind: "image" as const, file: FILE, contentType: "image/heic" };
    await expect(directUpload(req, "실패", refused.fetchImpl)).rejects.toThrow(
      "HEIC 사진은 안 됩니다.",
    );
    const badBytes = fakeServer({
      "/api/uploads/sign": () => json(SIGNED),
      PUT: () => new Response(null),
      "/api/uploads/confirm": () => json({ error: "JPG·PNG·GIF·WebP 사진만" }, 415),
    });
    await expect(directUpload(req, "실패", badBytes.fetchImpl)).rejects.toThrow("JPG·PNG·GIF·WebP");
  });

  it("does not confirm when the bucket PUT fails or is blocked", async () => {
    const blocked = fakeServer({ "/api/uploads/sign": () => json(SIGNED) }); // PUT throws (CORS)
    const req = { kind: "image" as const, file: FILE, contentType: "image/png" };
    await expect(directUpload(req, "사진을 올리지 못했습니다.", blocked.fetchImpl)).rejects.toThrow(
      "사진을 올리지 못했습니다. 연결을 확인해 주세요.",
    );
    const rejected = fakeServer({
      "/api/uploads/sign": () => json(SIGNED),
      PUT: () => new Response("<Error/>", { status: 403 }),
    });
    await expect(
      directUpload(req, "사진을 올리지 못했습니다.", rejected.fetchImpl),
    ).rejects.toThrow("사진을 올리지 못했습니다.");
    expect(rejected.calls.map((c) => c.url)).not.toContain("/api/uploads/confirm");
  });
});
