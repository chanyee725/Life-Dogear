import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidItemId } from "@/lib/ids";
import {
  assertPdfBytes,
  deletePdf,
  isPdfBytes,
  pdfAbsolutePath,
  pdfExists,
  pdfRelativePath,
  pdfSize,
  PdfStorageError,
  readPdfStream,
  writePdf,
} from "@/lib/storage/pdf";

const UUID = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const pdf = (body = "1.7\n%%EOF") => new TextEncoder().encode(`%PDF-${body}`);

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof PdfStorageError ? error.code : "other";
  }
  return undefined;
}

describe("paper id validation", () => {
  it.each([UUID, "seed-paper-1", "seed-paper"])("accepts %s", (id) => {
    expect(isValidItemId(id)).toBe(true);
  });

  it.each([
    "",
    "../etc/passwd",
    "seed-../x",
    "seed-",
    "seed--x",
    "Seed-paper-1",
    `${UUID}/x`,
    UUID.toUpperCase(),
    "paper-1",
    "seed-paper-1.pdf",
    "seed-paper-1\0",
    `seed-${"a".repeat(80)}`,
    42,
    null,
  ])("rejects %j", (id) => {
    expect(isValidItemId(id)).toBe(false);
  });

  it("builds paths from the id only", () => {
    expect(pdfRelativePath(UUID)).toBe(`data/pdfs/${UUID}.pdf`);
    expect(pdfAbsolutePath("seed-paper-1", "/srv/app")).toBe("/srv/app/data/pdfs/seed-paper-1.pdf");
    expect(codeOf(() => pdfRelativePath("../../secret"))).toBe("invalid_id");
    expect(codeOf(() => pdfAbsolutePath("a/b", "/srv/app"))).toBe("invalid_id");
  });
});

describe("magic bytes", () => {
  it("detects %PDF- headers", () => {
    expect(isPdfBytes(pdf())).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode("%PDF"))).toBe(false);
    expect(isPdfBytes(new TextEncoder().encode(" %PDF-1.7"))).toBe(false);
    expect(isPdfBytes(new TextEncoder().encode("<html>"))).toBe(false);
    expect(isPdfBytes(new Uint8Array())).toBe(false);
  });

  it("rejects empty, oversized and non-PDF data", () => {
    expect(codeOf(() => assertPdfBytes(new Uint8Array()))).toBe("empty");
    expect(codeOf(() => assertPdfBytes(new TextEncoder().encode("hello")))).toBe("not_pdf");
    expect(codeOf(() => assertPdfBytes(pdf("x".repeat(20)), 10))).toBe("too_large");
    expect(codeOf(() => assertPdfBytes(pdf()))).toBeUndefined();
  });
});

describe("file operations", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "rb-pdf-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes, reads, replaces and deletes", async () => {
    const options = { root };
    expect(await pdfExists(UUID, options)).toBe(false);

    expect(await writePdf(UUID, pdf("first"), options)).toBe(`data/pdfs/${UUID}.pdf`);
    expect(await pdfSize(UUID, options)).toBe(pdf("first").length);

    await writePdf(UUID, pdf("second!"), options);
    const text = await new Response(readPdfStream(UUID, undefined, options)).text();
    expect(text).toBe("%PDF-second!");
    expect(await new Response(readPdfStream(UUID, { start: 5, end: 7 }, options)).text()).toBe(
      "sec",
    );
    // No temp files left behind.
    expect(await readdir(join(root, "data/pdfs"))).toEqual([`${UUID}.pdf`]);

    expect(await deletePdf(UUID, options)).toBe(true);
    expect(await deletePdf(UUID, options)).toBe(false);
    expect(await pdfExists(UUID, options)).toBe(false);
  });

  it("does not write invalid data or ids", async () => {
    await expect(writePdf(UUID, new TextEncoder().encode("nope"), { root })).rejects.toMatchObject({
      code: "not_pdf",
    });
    await expect(writePdf("../x", pdf(), { root })).rejects.toMatchObject({ code: "invalid_id" });
    await expect(pdfExists(UUID, { root })).resolves.toBe(false);
  });

  it("keeps the previous file when a replacement is rejected", async () => {
    await writePdf(UUID, pdf("keep"), { root });
    await expect(writePdf(UUID, new Uint8Array(), { root })).rejects.toBeInstanceOf(
      PdfStorageError,
    );
    expect(await readFile(join(root, "data/pdfs", `${UUID}.pdf`), "utf8")).toBe("%PDF-keep");
  });

  it("treats a directory at the path as missing", async () => {
    await mkdir(join(root, "data/pdfs/seed-paper-1.pdf"), { recursive: true });
    expect(await pdfSize("seed-paper-1", { root })).toBeNull();
  });
});
