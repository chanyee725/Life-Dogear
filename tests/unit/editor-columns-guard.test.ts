// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { DOMParser } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

function mount(content: string) {
  editor?.destroy();
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createExtensions(""), content });
  return editor;
}

const md = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

describe("columns guards", () => {
  it("escapes marker-like text in a column and reads it back unchanged", () => {
    const e = mount("");
    const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
    e.commands.setContent({
      type: "doc",
      content: [
        {
          type: "columns",
          content: [
            { type: "column", content: [p(":::"), p("::: column")] },
            { type: "column", content: [p("::: columns"), p("옆")] },
          ],
        },
      ],
    });
    const first = md(e);
    expect(first).toContain("\\:::\n");
    const again = mount(first);
    const texts = again
      .getJSON()
      .content?.[0].content?.map((c: JSONContent) =>
        c.content?.map((n: JSONContent) => n.content?.[0]?.text),
      );
    expect(texts).toEqual([
      [":::", "::: column"],
      ["::: columns", "옆"],
    ]);
    expect(md(again)).toBe(first);
  });

  it("never nests columns, even from pasted HTML", () => {
    const e = mount("");
    const html =
      '<div data-type="columns"><div data-type="column"><div data-type="columns">' +
      '<div data-type="column"><p>a</p></div><div data-type="column"><p>b</p></div>' +
      '</div></div><div data-type="column"><p>c</p></div></div>';
    const dom = document.createElement("div");
    dom.innerHTML = html;
    // Same parser the editor uses for pasted HTML; drops are checked against the same schema.
    const doc = DOMParser.fromSchema(e.schema).parse(dom);
    doc.check();
    let outer = 0;
    doc.descendants((node) => {
      if (node.type.name !== "column") return;
      node.descendants((inner) => {
        expect(inner.type.name).not.toBe("columns");
      });
    });
    doc.forEach((node) => {
      if (node.type.name === "columns") outer++;
    });
    expect(outer).toBeGreaterThan(0);
    expect(doc.textContent).toContain("c");
    const { column, columns, blockquote, listItem } = e.schema.nodes;
    for (const parent of [column, blockquote, listItem]) {
      expect(parent.contentMatch.matchType(columns)).toBeNull();
    }
  });
});
