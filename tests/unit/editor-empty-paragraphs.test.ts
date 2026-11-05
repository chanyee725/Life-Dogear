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

function mount(content: string | object) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createExtensions(""), content });
  return editor;
}

const md = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

const p = (text?: string) =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

describe("empty paragraphs survive the Markdown round-trip", () => {
  it("keeps the number of consecutive blank lines between blocks", () => {
    const e = mount({
      type: "doc",
      content: [
        { type: "codeBlock", attrs: { language: "bash" }, content: [{ type: "text", text: "ls" }] },
        p(),
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Workspace 셋업" }] },
        p("a"),
        p(),
        p(),
        p("b"),
      ],
    });
    const saved = md(e);
    const reloaded = mount(saved);
    expect(reloaded.getJSON().content?.map((n) => n.type + (n.content ? "" : ":empty"))).toEqual([
      "codeBlock",
      "paragraph:empty",
      "heading",
      "paragraph",
      "paragraph:empty",
      "paragraph:empty",
      "paragraph",
    ]);
    expect(md(reloaded)).toBe(saved);
  });

  it("leaves existing bodies without empty paragraphs unchanged", () => {
    const body = "# 제목\n\n본문\n\n- 하나\n- 둘\n\n```ts\nconst a = 1;\n```";
    expect(md(mount(body))).toBe(body);
    expect(md(mount(""))).toBe("");
  });
});
