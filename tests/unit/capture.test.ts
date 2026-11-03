import { describe, expect, it } from "vitest";
import {
  draftToText,
  EMPTY_DRAFT,
  hasContent,
  isBareUrl,
  linkThoughtText,
  linkTitle,
  saveKey,
} from "@/components/capture/capture";

const enter = (mods: Partial<Parameters<typeof saveKey>[0]> = {}) => ({
  key: "Enter",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("quick capture", () => {
  it("recognises a pasted bare http(s) URL only", () => {
    expect(isBareUrl(" https://arxiv.org/abs/1706.03762 ")).toBe(true);
    expect(isBareUrl("http://example.com")).toBe(true);
    expect(isBareUrl("see https://example.com")).toBe(false);
    expect(isBareUrl("https://a.com\nhttps://b.com")).toBe(false);
    expect(isBareUrl("ftp://example.com")).toBe(false);
    expect(isBareUrl("javascript:alert(1)")).toBe(false);
    expect(isBareUrl("")).toBe(false);
  });

  it("titles a link by host and path (60 chars), without fetching", () => {
    expect(linkTitle(new URL("https://www.example.com/"))).toBe("example.com");
    expect(linkTitle(new URL("https://example.com/a/b/?q=1#x"))).toBe("example.com/a/b");
    expect(linkTitle(new URL("https://ko.wikipedia.org/wiki/%EC%97%B0%EA%B5%AC"))).toBe(
      "ko.wikipedia.org/wiki/연구",
    );
    const long = linkTitle(new URL(`https://example.com/${"x".repeat(100)}`));
    expect(long).toHaveLength(60);
    expect(long.endsWith("…")).toBe(true);
  });

  it("saves a link as note title (or URL title) + URL in the body", () => {
    expect(linkThoughtText("https://example.com/post", "")).toBe(
      "example.com/post\n\nhttps://example.com/post",
    );
    expect(linkThoughtText("https://example.com/post", "  읽어 볼 글 \n왜냐하면")).toBe(
      "읽어 볼 글\n\nhttps://example.com/post\n\n왜냐하면",
    );
    expect(linkThoughtText("example.com", "")).toBeNull();
  });

  it("validates the draft and knows when there is something to lose", () => {
    expect(hasContent(EMPTY_DRAFT)).toBe(false);
    expect(hasContent({ ...EMPTY_DRAFT, text: " 생각 " })).toBe(true);
    expect(hasContent({ ...EMPTY_DRAFT, kind: "link", note: "메모" })).toBe(true);
    expect(draftToText({ ...EMPTY_DRAFT, text: "  " })).toEqual({ error: "내용을 입력하세요." });
    expect(draftToText({ ...EMPTY_DRAFT, text: "생각" })).toEqual({ text: "생각" });
    expect(draftToText({ ...EMPTY_DRAFT, kind: "link" })).toEqual({ error: "링크를 입력하세요." });
    expect(draftToText({ ...EMPTY_DRAFT, kind: "link", url: "nope" })).toHaveProperty("error");
  });

  it("saves on ⌘/Ctrl+Enter (close), ⇧⌘Enter (continue), Enter in link fields; never mid-IME", () => {
    expect(saveKey(enter({ metaKey: true }), "text")).toBe("close");
    expect(saveKey(enter({ ctrlKey: true }), "text")).toBe("close");
    expect(saveKey(enter({ metaKey: true, shiftKey: true }), "text")).toBe("continue");
    expect(saveKey(enter(), "text")).toBeNull(); // newline
    expect(saveKey(enter(), "url")).toBe("close");
    expect(saveKey(enter(), "note")).toBe("close");
    expect(saveKey(enter({ metaKey: true, isComposing: true }), "text")).toBeNull();
    expect(saveKey(enter({ keyCode: 229 }), "url")).toBeNull();
    expect(saveKey({ ...enter(), key: "a", metaKey: true }, "text")).toBeNull();
  });
});
