import { describe, expect, it } from "vitest";
import { bodyPreview, isHttpUrl } from "@/app/notes/source";

describe("note source link", () => {
  it("links http(s) only", () => {
    expect(isHttpUrl("https://example.com/book")).toBe(true);
    expect(isHttpUrl(" http://example.com ")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("example.com")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});

describe("note card preview", () => {
  it("takes the first text line, skipping headings marks and photos", () => {
    expect(bodyPreview("# 1장\n\n![사진](/a.png)\n- 핵심 정리\n")).toBe("1장");
    expect(bodyPreview("![사진](/a.png)\n\n- [ ] 다시 볼 것")).toBe("다시 볼 것");
    expect(bodyPreview("")).toBe("");
  });
});
