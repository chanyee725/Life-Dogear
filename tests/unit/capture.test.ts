import { describe, expect, it } from "vitest";
import {
  autosizeHeight,
  draftToSave,
  draftToText,
  EMPTY_DRAFT,
  hasContent,
  isBareUrl,
  linkThoughtText,
  linkTitle,
  nextKind,
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

describe("quick capture 노트", () => {
  const note = { ...EMPTY_DRAFT, kind: "note" as const };

  it("cycles 생각 → 링크 → 노트 with the arrow keys", () => {
    expect(nextKind("thought", 1)).toBe("link");
    expect(nextKind("link", 1)).toBe("note");
    expect(nextKind("note", 1)).toBe("thought");
    expect(nextKind("thought", -1)).toBe("note");
  });

  it("needs a title; the body is optional", () => {
    expect(draftToSave(note)).toEqual({ error: "제목을 입력하세요." });
    expect(draftToSave({ ...note, body: "본문만" })).toEqual({ error: "제목을 입력하세요." });
    expect(draftToSave({ ...note, title: " 1장 정리 ", body: "\n핵심\n" })).toEqual({
      kind: "note",
      title: "1장 정리",
      body: "핵심",
    });
    expect(draftToSave({ ...note, title: "제목만" })).toEqual({
      kind: "note",
      title: "제목만",
      body: "",
    });
  });

  it("keeps 생각 and 링크 saving as thoughts", () => {
    expect(draftToSave({ ...EMPTY_DRAFT, text: "생각" })).toEqual({ kind: "thought", text: "생각" });
    expect(draftToSave({ ...EMPTY_DRAFT, kind: "link", url: "https://a.com/x" })).toEqual({
      kind: "thought",
      text: "a.com/x\n\nhttps://a.com/x",
    });
  });

  it("counts a title or a body as something to lose", () => {
    expect(hasContent(note)).toBe(false);
    expect(hasContent({ ...note, title: "제목" })).toBe(true);
    expect(hasContent({ ...note, body: "본문" })).toBe(true);
    // Text typed under another kind doesn't count while 노트 is shown.
    expect(hasContent({ ...note, text: "생각" })).toBe(false);
  });

  it("saves the note only with ⌘/Ctrl+Enter (Enter in the title moves to the body)", () => {
    expect(saveKey(enter(), "title")).toBeNull();
    expect(saveKey(enter(), "body")).toBeNull();
    expect(saveKey(enter({ metaKey: true }), "title")).toBe("close");
    expect(saveKey(enter({ ctrlKey: true, shiftKey: true }), "body")).toBe("continue");
  });
});

describe("생각 box height", () => {
  // 15px text, line-height 1.5 = 22.5px; py-2 + 1px borders = 18px.
  const line = 22.5;
  const chrome = 18;
  it("is 3 lines when empty or short", () => {
    expect(autosizeHeight(line, line, chrome)).toEqual({
      height: 3 * line + chrome,
      scroll: false,
    });
    expect(autosizeHeight(0, line, chrome).height).toBe(3 * line + chrome);
  });
  it("grows with the text", () => {
    expect(autosizeHeight(7 * line, line, chrome)).toEqual({
      height: 7 * line + chrome,
      scroll: false,
    });
  });
  it("stops at 12 lines and scrolls", () => {
    expect(autosizeHeight(12 * line, line, chrome)).toEqual({
      height: 12 * line + chrome,
      scroll: false,
    });
    expect(autosizeHeight(30 * line, line, chrome)).toEqual({
      height: 12 * line + chrome,
      scroll: true,
    });
  });
});
