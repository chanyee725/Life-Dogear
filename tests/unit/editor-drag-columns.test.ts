// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { dropPosition, moveBlock, type Block } from "@/components/editor/drag-handle";
import { createExtensions } from "@/components/editor/extensions";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

function mount(content: string) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createExtensions(""), content });
  return editor;
}
const md = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

const group = (...cols: string[]) =>
  ["::: columns", ...cols.map((c) => `::: column\n${c}\n:::`), ":::"].join("\n");

/** The block (any depth) whose own text is exactly `text`: a paragraph, or the list item holding it. */
function block(e: Editor, text: string, type = "paragraph"): Block {
  let found: Block | null = null;
  e.state.doc.descendants((node, pos) => {
    if (!found && node.type.name === type && node.textContent === text) found = { pos, node };
  });
  if (!found) throw new Error(`no ${type} "${text}"`);
  return found;
}
const columnsBlock = (e: Editor): Block => {
  let found: Block | null = null;
  e.state.doc.descendants((node, pos) => {
    if (!found && node.type.name === "columns") found = { pos, node };
  });
  if (!found) throw new Error("no columns");
  return found;
};

function drop(e: Editor, dragged: Block, hover: Block, after: boolean) {
  const to = dropPosition(e.state.doc, dragged, hover, after);
  expect(to).not.toBeNull();
  const tr = moveBlock(e.state, dragged.pos, to!, dragged.node);
  expect(tr).not.toBeNull();
  e.view.dispatch(tr!);
}

describe("dropPosition across columns", () => {
  it("doc → column: a top-level paragraph lands inside the second column", () => {
    const e = mount(`바깥\n\n${group("왼쪽", "오른쪽")}`);
    drop(e, block(e, "바깥"), block(e, "오른쪽"), true);
    expect(md(e)).toBe(group("왼쪽", "오른쪽\n\n바깥"));
  });

  it("doc → column: lands before a paragraph of the first column too", () => {
    const e = mount(`${group("왼쪽", "오른쪽")}\n\n바깥`);
    drop(e, block(e, "바깥"), block(e, "왼쪽"), false);
    expect(md(e)).toBe(group("바깥\n\n왼쪽", "오른쪽"));
  });

  it("column → doc: a paragraph leaves its column for the top level", () => {
    const e = mount(`${group("왼쪽", "오른쪽 하나\n\n오른쪽 둘")}\n\n바깥`);
    drop(e, block(e, "오른쪽 둘"), block(e, "바깥"), true);
    expect(md(e)).toBe(`${group("왼쪽", "오른쪽 하나")}\n\n바깥\n\n오른쪽 둘`);
  });

  it("column → column: moves between columns", () => {
    const e = mount(group("왼쪽 하나\n\n왼쪽 둘", "오른쪽"));
    drop(e, block(e, "왼쪽 둘"), block(e, "오른쪽"), false);
    expect(md(e)).toBe(group("왼쪽 하나", "왼쪽 둘

오른쪽"));
  });

  it("columns → column: a whole columns block cannot go into a column", () => {
    const e = mount(`${group("왼쪽", "오른쪽")}\n\n${group("a", "b")}`);
    const first = columnsBlock(e);
    let second: Block | null = null;
    e.state.doc.descendants((node, pos) => {
      if (node.type.name === "columns" && pos !== first.pos) second = { pos, node };
    });
    expect(dropPosition(e.state.doc, second!, block(e, "왼쪽"), false)).toBeNull();
    expect(dropPosition(e.state.doc, second!, block(e, "오른쪽"), true)).toBeNull();
  });

  it("a list item can move into a column's list but not onto a paragraph there", () => {
    const e = mount(`- 가\n- 나\n\n${group("- 다\n- 라", "문단")}`);
    expect(
      dropPosition(e.state.doc, block(e, "가", "listItem"), block(e, "문단"), true),
    ).toBeNull();
    drop(e, block(e, "가", "listItem"), block(e, "다", "listItem"), false);
    expect(md(e)).toBe(`- 나\n\n${group("- 가\n- 다\n- 라", "문단")}`);
  });
});

describe("taking the last list item out of a column", () => {
  it("removes the empty list instead of leaving a bullet behind", () => {
    const e = mount(`바깥\n\n${group("왼쪽", "- 혼자\n\n끝")}`);
    drop(e, block(e, "혼자", "listItem"), block(e, "바깥"), true);
    const saved = md(e);
    expect(saved).toBe(`바깥

- 혼자

${group("왼쪽", "끝")}`);
    expect(saved).not.toMatch(/^- *$/m);
  });

  it("a column whose only block is that list keeps an empty line, still two columns", () => {
    const e = mount(`바깥\n\n${group("왼쪽", "- 혼자")}`);
    drop(e, block(e, "혼자", "listItem"), block(e, "바깥"), false);
    let columns = 0;
    e.state.doc.descendants((n) => {
      if (n.type.name === "column") columns++;
    });
    expect(columns).toBe(2);
    expect(md(e)).not.toMatch(/^- *$/m);
  });
});
