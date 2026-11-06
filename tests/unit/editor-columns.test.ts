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

/** Loads `markdown`, saves it, loads the result again: both saves must match. */
function roundTrip(markdown: string) {
  const first = md(mount(markdown));
  editor?.destroy();
  const second = md(mount(first));
  return { first, second };
}

const SRC = "/api/images/00000000-0000-0000-0000-000000000000.png";

const group = (...cols: string[]) =>
  ["::: columns", ...cols.map((c) => `::: column\n${c}\n:::`), ":::"].join("\n");

const types = (e: Editor) => e.getJSON().content?.map((n) => n.type);
const columnsNode = (e: Editor): JSONContent | undefined =>
  (e.getJSON().content as JSONContent[] | undefined)?.find((n) => n.type === "columns");

describe("columns Markdown round trip", () => {
  it("keeps two columns and reads them as columns > column", () => {
    const src = group("왼쪽", "오른쪽");
    const e = mount(src);
    const node = columnsNode(e)!;
    expect(node.content?.map((c) => c.type)).toEqual(["column", "column"]);
    expect(node.content?.map((c) => c.content?.[0]?.content?.[0]?.text)).toEqual(["왼쪽", "오른쪽"]);
    expect(md(e)).toBe(src);
    expect(e.view.dom.querySelectorAll('[data-type="columns"] > [data-type="column"]')).toHaveLength(2);
  });

  it("keeps three columns", () => {
    const src = group("하나", "둘", "셋");
    const e = mount(src);
    expect(columnsNode(e)?.content).toHaveLength(3);
    expect(md(e)).toBe(src);
  });

  it("keeps lists, code and a photo inside a column", () => {
    const left = "- 가\n- 나\n\n1. 하나\n2. 둘";
    const right = `\`\`\`ts\nconst a = 1;\n\`\`\`\n\n![캡션](${SRC})`;
    const src = group(left, right);
    const e = mount(src);
    const [l, r] = columnsNode(e)!.content!;
    expect(l.content?.map((n) => n.type)).toEqual(["bulletList", "orderedList"]);
    expect(r.content?.map((n) => n.type)).toEqual(["codeBlock", "image"]);
    expect(md(e)).toBe(src);
  });

  it("is stable on a second save and keeps text around the group", () => {
    const src = `앞 문단\n\n${group("왼쪽", "오른쪽")}\n\n뒤 문단`;
    const { first, second } = roundTrip(src);
    expect(first).toBe(src);
    expect(second).toBe(first);
  });

  it("keeps a code fence that contains ::: lines inside a column", () => {
    const src = group("```\n:::\n```", "옆");
    const e = mount(src);
    expect(columnsNode(e)?.content).toHaveLength(2);
    expect(columnsNode(e)?.content?.[0].content?.[0].type).toBe("codeBlock");
    expect(md(e)).toBe(src);
  });
});

describe("documents without columns", () => {
  const DOCS = [
    "",
    "그냥 문단",
    "## 제목\n\n- 가\n- 나\n\n> 인용\n\n```ts\nconst a = 1;\n```",
    `| a | b |\n| --- | --- |\n| 1 | 2 |\n\n![](${SRC})\n\n끝`,
    "&nbsp;\n\n빈 줄 뒤",
  ];

  it.each(DOCS)("serializes byte for byte: %j", (doc) => {
    const e = mount(doc);
    expect(types(e)?.includes("columns") ?? false).toBe(false);
    expect(md(e)).toBe(doc);
  });

  it("leaves stray ::: lines as ordinary text", () => {
    for (const doc of [":::", "::: columns", "::: column\n:::", "text\n\n:::\n\ntext"]) {
      const e = mount(doc);
      expect(types(e)?.includes("columns") ?? false, doc).toBe(false);
      expect(md(e).replace(/\\/g, ""), doc).toContain(":::");
      editor?.destroy();
    }
  });
});

describe("columns boundaries", () => {
  it("does not read one column as a group", () => {
    const e = mount(group("혼자"));
    expect(types(e)?.includes("columns") ?? false).toBe(false);
  });

  it("does not read four columns as a group", () => {
    const e = mount(group("1", "2", "3", "4"));
    expect(types(e)?.includes("columns") ?? false).toBe(false);
  });

  it("does not read an unclosed group as columns", () => {
    const e = mount("::: columns\n::: column\n왼쪽\n:::\n::: column\n오른쪽\n:::");
    expect(types(e)?.includes("columns") ?? false).toBe(false);
  });

  it("does not nest columns inside a column", () => {
    const inner = group("a", "b");
    const e = mount(group(inner, "옆"));
    expect(types(e)?.includes("columns") ?? false).toBe(false);
  });

  it("inserts 2 and 3 columns, none for 1 or 4", () => {
    for (const [count, ok] of [[2, true], [3, true], [1, false], [4, false]] as const) {
      const e = mount("");
      expect(e.commands.insertColumns(count), String(count)).toBe(ok);
      expect(columnsNode(e)?.content?.length ?? 0, String(count)).toBe(ok ? count : 0);
      editor?.destroy();
    }
  });

  it("does not insert columns inside a column", () => {
    const e = mount(group("왼쪽", "오른쪽"));
    e.commands.setTextSelection(4);
    expect(e.commands.insertColumns(2)).toBe(false);
  });

  it("blank paragraphs inside a column survive a round trip", () => {
    const src = group("가\n\n&nbsp;\n\n나", "옆");
    expect(roundTrip(src).second).toBe(src);
  });
});
