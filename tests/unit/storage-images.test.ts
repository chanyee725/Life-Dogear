import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bodyPreview } from "@/app/reviews/labels";
import {
  imageContentType,
  imageSize,
  ImageStorageError,
  isImageName,
  sniffImage,
  writeImage,
} from "@/lib/storage/images";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );

const JPG = bytes([0xff, 0xd8, 0xff, 0xe0], "rest");
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "rest");
const GIF = bytes("GIF89a", "rest");
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const HEIC = bytes([0, 0, 0, 0x18], "ftypheic", "rest");
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("sniffImage", () => {
  it("detects raster formats from their bytes", () => {
    expect(sniffImage(JPG)).toBe("jpg");
    expect(sniffImage(PNG)).toBe("png");
    expect(sniffImage(GIF)).toBe("gif");
    expect(sniffImage(WEBP)).toBe("webp");
  });
  it("flags HEIC and rejects anything else, SVG included", () => {
    expect(sniffImage(HEIC)).toBe("heic");
    expect(sniffImage(SVG)).toBeNull();
    expect(sniffImage(bytes("%PDF-1.7"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("isImageName", () => {
  it("accepts only names the store creates", () => {
    expect(isImageName("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png")).toBe(true);
    expect(isImageName("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.svg")).toBe(false);
    expect(isImageName("../local.db")).toBe(false);
    expect(isImageName("x.png")).toBe(false);
  });
  it("maps extensions to content types", () => {
    expect(imageContentType("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.jpg")).toBe("image/jpeg");
    expect(imageContentType("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.webp")).toBe("image/webp");
  });
});

describe("writeImage", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "rb-images-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("stores under a fresh name with the sniffed extension", async () => {
    const name = await writeImage(PNG, { root });
    expect(isImageName(name)).toBe(true);
    expect(name.endsWith(".png")).toBe(true);
    const dir = join(root, "data", "images");
    expect(await readdir(dir)).toEqual([name]);
    expect(new Uint8Array(await readFile(join(dir, name)))).toEqual(PNG);
    expect(await imageSize(name, { root })).toBe(PNG.length);
  });

  it("never reuses a name", async () => {
    const a = await writeImage(JPG, { root });
    const b = await writeImage(JPG, { root });
    expect(a).not.toBe(b);
  });

  it("rejects empty, oversized, HEIC and non-image files", async () => {
    const code = async (data: Uint8Array, maxBytes?: number) =>
      writeImage(data, { root, maxBytes }).then(
        () => "ok",
        (e: unknown) => (e instanceof ImageStorageError ? e.code : "other"),
      );
    expect(await code(new Uint8Array())).toBe("empty");
    expect(await code(PNG, 4)).toBe("too_large");
    expect(await code(HEIC)).toBe("heic");
    expect(await code(SVG)).toBe("not_image");
  });

  it("reports a missing image as null", async () => {
    expect(await imageSize("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png", { root })).toBeNull();
  });
});

describe("bodyPreview", () => {
  it("skips photo lines so previews show text", () => {
    expect(bodyPreview("![화이트보드](/api/images/a.png)\n\n회의 메모")).toBe("회의 메모");
  });
});
