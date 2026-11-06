// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

function mount(markdown: string, editable = true) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createExtensions(""), content: markdown, editable });
  return editor;
}

const md = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

const SRC = "/api/images/00000000-0000-0000-0000-000000000000.png";

describe("image captions (Markdown alt text)", () => {
  it("round-trips a caption through save and reload", () => {
    const saved = md(mount(`앞 문단\n\n![화이트보드 [초안] 정리](${SRC})\n\n뒤 문단`));
    expect(saved).toBe(`앞 문단\n\n![화이트보드 \\[초안\\] 정리](${SRC})\n\n뒤 문단`);
    editor?.destroy();
    const again = mount(saved);
    expect(again.getJSON().content?.find((n) => n.type === "image")?.attrs?.alt).toBe(
      "화이트보드 [초안] 정리",
    );
    expect(md(again)).toBe(saved);
  });

  it("keeps a photo without a caption as ![](url)", () => {
    expect(md(mount(`![](${SRC})`))).toBe(`![](${SRC})`);
  });

  it("renders the photo, a copy button and the caption in a figure", () => {
    const e = mount(`![회의 메모](${SRC})`);
    const figure = e.view.dom.querySelector("figure.rb-image")!;
    expect(figure.querySelector("img")?.getAttribute("src")).toBe(SRC);
    expect(figure.querySelector("img")?.getAttribute("alt")).toBe("회의 메모");
    expect(figure.querySelector('button[aria-label="사진 복사"]')).not.toBeNull();
    const input = figure.querySelector<HTMLInputElement>("input.rb-image-caption-input")!;
    expect(input.value).toBe("회의 메모");
    expect(input.placeholder).toBe("캡션 추가");
    expect(figure.querySelector("figcaption")?.textContent).toBe("회의 메모");
  });

  it("writes typed caption text back into the Markdown", () => {
    const e = mount(`![](${SRC})`);
    const input = e.view.dom.querySelector<HTMLInputElement>("input.rb-image-caption-input")!;
    input.value = "새 캡션";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(md(e)).toBe(`![새 캡션](${SRC})`);
  });

  it("hides an empty caption", () => {
    const e = mount(`![](${SRC})`, false);
    expect(e.view.dom.querySelector<HTMLElement>("figcaption")?.hidden).toBe(true);
  });
});
