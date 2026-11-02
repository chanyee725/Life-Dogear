import { describe, expect, it } from "vitest";
import { resolveDbConfig } from "@/db/config";
import { dataDir, localDatabaseUrl, pdfDirSetting } from "@/lib/data-dir";
import { pdfAbsolutePath, pdfRelativePath } from "@/lib/storage/pdf";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("DATA_DIR", () => {
  it("defaults to data and normalizes relative and absolute paths", () => {
    expect(dataDir({})).toBe("data");
    expect(dataDir({ DATA_DIR: "  " })).toBe("data");
    expect(dataDir({ DATA_DIR: "./data/e2e/" })).toBe("data/e2e");
    expect(dataDir({ DATA_DIR: "data//e2e/../e2e" })).toBe("data/e2e");
    expect(dataDir({ DATA_DIR: "/srv/rb-data/" })).toBe("/srv/rb-data");
    expect(dataDir({ DATA_DIR: "data\\win" })).toBe("data/win");
    expect(pdfDirSetting({ DATA_DIR: "data/e2e" })).toBe("data/e2e/pdfs");
    expect(localDatabaseUrl({})).toBe("file:data/local.db");
  });

  it("drives the default database and PDF storage paths", () => {
    expect(resolveDbConfig({ DATA_DIR: "data/e2e" })).toEqual({ url: "file:data/e2e/local.db" });
    expect(resolveDbConfig({ DATA_DIR: "data/e2e", DATABASE_URL: "libsql://x.turso.io" }).url).toBe(
      "libsql://x.turso.io",
    );

    const previous = process.env.DATA_DIR;
    try {
      process.env.DATA_DIR = "data/e2e";
      expect(pdfRelativePath(UUID)).toBe(`data/e2e/pdfs/${UUID}.pdf`);
      expect(pdfAbsolutePath(UUID, "/app")).toBe(`/app/data/e2e/pdfs/${UUID}.pdf`);
      process.env.DATA_DIR = "/srv/rb";
      expect(pdfAbsolutePath(UUID, "/app")).toBe(`/srv/rb/pdfs/${UUID}.pdf`);
      delete process.env.DATA_DIR;
      expect(pdfRelativePath(UUID)).toBe(`data/pdfs/${UUID}.pdf`);
    } finally {
      if (previous === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previous;
    }
  });
});
