// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";

const MARKDOWN = [
  "앞 문단",
  "```ts\nconst answer: number = 42;\n```",
  '```launch\n<launch>\n  <node pkg="demo" type="talker"/>\n</launch>\n```',
  "```\nconst plain = 1;\n```",
  "```mermaid\ngraph TD\n  A --> B\n```",
].join("\n\n");

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

function mount(markdown: string) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createExtensions(""), content: markdown });
  return editor;
}

const getMarkdown = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

const hljsSpans = (block: Element) => block.querySelectorAll("pre [class*='hljs-']");

describe("code blocks in the real editor (jsdom)", () => {
  it("decorates registered languages only; no language and unknown ones stay plain", () => {
    const e = mount(MARKDOWN);
    const blocks = [...e.view.dom.querySelectorAll(".rb-code")];
    expect(blocks.map((b) => b.querySelector(".rb-code-lang")?.textContent)).toEqual([
      "ts",
      "launch",
      "",
      "mermaid",
    ]);
    const [ts, launch, none, mermaid] = blocks as [Element, Element, Element, Element];
    expect(hljsSpans(ts).length).toBeGreaterThan(0);
    expect(ts.querySelector(".hljs-keyword")?.textContent).toBe("const");
    expect(launch.querySelector(".hljs-name")?.textContent).toBe("launch");
    // `const` would be a keyword if anything guessed the language.
    expect(hljsSpans(none)).toHaveLength(0);
    expect(hljsSpans(mermaid)).toHaveLength(0);
    // The copy button lives outside the editable code.
    expect(ts.querySelector("button.rb-code-copy")?.closest("pre")).toBeNull();
  });

  it("round-trips Markdown -> document -> Markdown unchanged", () => {
    const e = mount(MARKDOWN);
    expect(
      e
        .getJSON()
        .content?.slice(1)
        .map((n) => n.attrs?.language),
    ).toEqual(["ts", "launch", null, "mermaid"]);
    expect(getMarkdown(e)).toBe(MARKDOWN);

    // And once more through a fresh editor.
    const again = getMarkdown(e);
    e.destroy();
    expect(getMarkdown(mount(again))).toBe(MARKDOWN);
  });
});
