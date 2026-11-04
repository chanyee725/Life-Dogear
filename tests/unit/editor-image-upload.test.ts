import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageUploadType, isImageFile, uploadImage } from "@/components/editor/image-upload";
import { resetDirectUploadMode } from "@/lib/storage/direct-upload";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];
const HEIC = [0, 0, 0, 0x18, ...[..."ftypheic"].map((c) => c.charCodeAt(0)), 0, 0, 0, 0];
const SVG = [..."<svg xmlns='http://www.w3.org/2000/svg'/>"].map((c) => c.charCodeAt(0));

const file = (bytes: number[], name = "image", type = "") =>
  new File([new Uint8Array(bytes)], name, { type });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("isImageFile", () => {
  it("takes typed photos and untyped pastes with no or a photo extension", () => {
    expect(isImageFile(file(PNG, "a.png", "image/png"))).toBe(true);
    expect(isImageFile(file(PNG, "image"))).toBe(true);
    expect(isImageFile(file(PNG, "Screenshot.PNG"))).toBe(true);
    expect(isImageFile(file(PNG, "blob", "application/octet-stream"))).toBe(true);
  });

  it("leaves other files alone", () => {
    expect(isImageFile(file([1, 2, 3], "notes.md", "text/markdown"))).toBe(false);
    expect(isImageFile(file([1, 2, 3], "paper.pdf", "application/pdf"))).toBe(false);
    expect(isImageFile(file([1, 2, 3], "archive.zip"))).toBe(false);
  });
});

describe("imageUploadType", () => {
  it("keeps a declared photo type", async () => {
    expect(await imageUploadType(file(PNG, "a.png", "IMAGE/PNG"))).toBe("image/png");
  });

  it("reads the type from the bytes when the paste has none", async () => {
    expect(await imageUploadType(file(PNG))).toBe("image/png");
    expect(await imageUploadType(file(JPG, "blob", "application/octet-stream"))).toBe("image/jpeg");
  });

  it("still refuses HEIC and SVG", async () => {
    await expect(imageUploadType(file(HEIC))).rejects.toThrow(/HEIC/);
    await expect(imageUploadType(file(SVG))).rejects.toThrow(/JPG·PNG·GIF·WebP/);
    await expect(imageUploadType(file(SVG, "x.svg", "image/svg+xml"))).rejects.toThrow(
      /JPG·PNG·GIF·WebP/,
    );
  });
});

describe("uploadImage (bucket)", () => {
  const calls: { url: string; init?: RequestInit }[] = [];

  beforeEach(() => {
    resetDirectUploadMode();
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url === "/api/uploads/sign") {
          const { contentType } = JSON.parse(String(init?.body)) as { contentType: string };
          return json({
            mode: "s3",
            url: "https://bucket.example/rb/pending/x",
            method: "PUT",
            headers: { "Content-Type": contentType },
            token: "tok.sig",
          });
        }
        if (url.startsWith("https://bucket.example/")) return new Response(null, { status: 200 });
        if (url === "/api/uploads/confirm") return json({ url: "/api/images/a.png" }, 201);
        throw new TypeError("network");
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("signs an untyped pasted PNG as image/png", async () => {
    expect(await uploadImage(file(PNG))).toBe("/api/images/a.png");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      kind: "image",
      contentType: "image/png",
      size: PNG.length,
    });
    expect(calls[1].init?.headers).toEqual({ "Content-Type": "image/png" });
  });

  it("does not ask to sign a file that is not a photo", async () => {
    await expect(uploadImage(file(SVG))).rejects.toThrow(/JPG·PNG·GIF·WebP/);
    expect(calls).toHaveLength(0);
  });
});
