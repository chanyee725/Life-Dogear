// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";

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
const md = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

const columnsNode = (e: Editor): JSONContent | undefined =>
  (e.getJSON().content as JSONContent[] | undefined)?.find((n) => n.type === "columns");
const widths = (e: Editor) => columnsNode(e)?.content?.map((c) => c.attrs?.width ?? null);

/** `heads` are the text after `::: column` ("" for none). */
const group = (...heads: [string, string][]) =>
  [
    "::: columns",
    ...heads.map(([head, text]) => `::: column${head ? ` ${head}` : ""}\n${text}\n:::`),
    ":::",
  ].join("\n");

describe("column width (::: column 40)", () => {
  it("reads the number after ::: column as the width attr", () => {
    const e = mount(group(["40", "왼쪽"], ["60", "오른쪽"]));
    expect(columnsNode(e)?.content).toHaveLength(2);
    expect(widths(e)).toEqual([40, 60]);
  });

  it("saves the width back byte for byte and is stable on a second save", () => {
    const src = group(["40", "왼쪽"], ["60", "오른쪽"]);
    const first = md(mount(src));
    expect(first).toBe(src);
    editor?.destroy();
    expect(md(mount(first))).toBe(first);
  });

  it("columns without a width have no width attr and serialize exactly as before", () => {
    const src = group(["", "왼쪽"], ["", "오른쪽"]);
    const e = mount(src);
    expect(widths(e)).toEqual([null, null]);
    expect(md(e)).toBe(src);
  });

  it("keeps a three-column group with widths", () => {
    const src = group(["20", "a"], ["30", "b"], ["50", "c"]);
    const e = mount(src);
    expect(widths(e)).toEqual([20, 30, 50]);
    expect(md(e)).toBe(src);
  });

  it("changing a width attr writes only that number", () => {
    const e = mount(group(["", "왼쪽"], ["", "오른쪽"]));
    const cols = columnsNode(e)!.content!;
    // Rewrite both columns with new widths through the document JSON.
    e.commands.setContent({
      type: "doc",
      content: [
        {
          type: "columns",
          content: cols.map((c, i) => ({ ...c, attrs: { ...c.attrs, width: i === 0 ? 30 : 70 } })),
        },
      ],
    });
    expect(md(e)).toBe(group(["30", "왼쪽"], ["70", "오른쪽"]));
  });

  it.each(["abc", "0", "-5", "1000", "4.5", "40%", "40 50"])(
    "ignores a bad width (%s): the group still reads as columns without a width",
    (bad) => {
      const e = mount(group([bad, "왼쪽"], ["", "오른쪽"]));
      // Either the group is kept with no width, or it falls back to plain text, never a crash.
      const node = columnsNode(e);
      if (node) expect(node.content?.[0].attrs?.width ?? null).toBeNull();
      else expect(md(e)).toContain("왼쪽");
    },
  );

  it("documents without column widths are unchanged", () => {
    const src = "::: column 40\n단독\n:::";
    const e = mount(src);
    expect(columnsNode(e)).toBeUndefined();
  });
});
