// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { blockAt, dropPosition, isCurrent, moveBlock, type Block } from "@/components/editor/drag-handle";
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

/** Position before the top-level block at `index`. */
function topPos(e: Editor, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += e.state.doc.child(i).nodeSize;
  return pos;
}

/** Position of the first text matching `text` (inside its textblock). */
function textPos(e: Editor, text: string) {
  let found = -1;
  e.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text?.includes(text)) found = pos;
  });
  if (found < 0) throw new Error(`no ${text}`);
  return found;
}

function move(e: Editor, from: number, to: number) {
  const tr = moveBlock(e.state, from, to);
  if (!tr) throw new Error("no move");
  e.view.dispatch(tr);
}

describe("moveBlock", () => {
  it("moves a paragraph below a heading and keeps the Markdown", () => {
    const e = mount("first\n\n## Title\n\nlast");
    move(e, topPos(e, 0), topPos(e, 2));
    expect(md(e)).toBe("## Title\n\nfirst\n\nlast");
  });

  it("moves a code block and keeps its fence and blank lines", () => {
    const e = mount("a\n\n&nbsp;\n\n```bash\nls\n```\n\nb");
    move(e, topPos(e, 2), topPos(e, 0));
    const saved = md(e);
    expect(saved).toBe("```bash\nls\n```\n\na\n\n&nbsp;\n\nb");
    expect(md(mount(saved))).toBe(saved);
  });

  it("moves a table and a quote as whole blocks", () => {
    const e = mount("> quote\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nend");
    move(e, topPos(e, 1), topPos(e, 0));
    expect(md(e)).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |\n\n> quote\n\nend");
  });

  it("reorders list items one item at a time", () => {
    const e = mount("- one\n- two\n- three");
    const one = blockAt(e.state.doc, textPos(e, "one"))!;
    const three = blockAt(e.state.doc, textPos(e, "three"))!;
    expect(one.node.type.name).toBe("listItem");
    const to = dropPosition(e.state.doc, one, three, true)!;
    move(e, one.pos, to);
    expect(md(e)).toBe("- two\n- three\n- one");
  });

  it("reorders task items and keeps the checklist tight", () => {
    const e = mount("- [ ] a\n- [x] b");
    const b = blockAt(e.state.doc, textPos(e, "b"))!;
    const a = blockAt(e.state.doc, textPos(e, "a"))!;
    move(e, b.pos, dropPosition(e.state.doc, b, a, false)!);
    expect(md(e)).toBe("- [x] b\n- [ ] a");
  });

  it("removes a one-item list when its only item moves to another list", () => {
    const e = mount("- solo\n\npara\n\n1. x\n2. y");
    const solo = blockAt(e.state.doc, textPos(e, "solo"))!;
    const y = blockAt(e.state.doc, textPos(e, "y"))!;
    move(e, solo.pos, dropPosition(e.state.doc, solo, y, true)!);
    expect(md(e)).toBe("para\n\n1. x\n2. y\n3. solo");
  });

  it("removes a one-item nested list when its only item moves out", () => {
    const e = mount("- a\n  - inner\n- b");
    const inner = blockAt(e.state.doc, textPos(e, "inner"))!;
    const b = blockAt(e.state.doc, textPos(e, "b"))!;
    move(e, inner.pos, dropPosition(e.state.doc, inner, b, true)!);
    expect(md(e)).toBe("- a\n- b\n- inner");
  });

  it("moves nothing once an edit has shifted the recorded block", () => {
    const e = mount("one\n\ntwo\n\nthree");
    const two = blockAt(e.state.doc, textPos(e, "two"))!;
    const end = e.state.doc.content.size;
    e.view.dispatch(e.state.tr.insertText("x", 1)); // typing in the block above
    expect(isCurrent(e.state.doc, two)).toBe(false);
    expect(moveBlock(e.state, two.pos, end, two.node)).toBeNull();
    const fresh = blockAt(e.state.doc, textPos(e, "two"))!;
    expect(isCurrent(e.state.doc, fresh)).toBe(true);
    move(e, fresh.pos, e.state.doc.content.size);
    expect(md(e)).toBe("xone\n\nthree\n\ntwo");
  });

  it("returns null when dropped onto itself", () => {
    const e = mount("a\n\nb");
    expect(moveBlock(e.state, topPos(e, 0), topPos(e, 0))).toBeNull();
    expect(moveBlock(e.state, topPos(e, 0), topPos(e, 1))).toBeNull();
  });
});

describe("dropPosition", () => {
  it("keeps list items in lists and top-level blocks at the top level", () => {
    const e = mount("para\n\n- item");
    const doc = e.state.doc;
    const para: Block = blockAt(doc, textPos(e, "para"))!;
    const item: Block = blockAt(doc, textPos(e, "item"))!;
    const list: Block = { pos: topPos(e, 1), node: doc.child(1) };
    expect(dropPosition(doc, item, para, false)).toBeNull();
    expect(dropPosition(doc, para, item, false)).toBeNull();
    expect(dropPosition(doc, para, list, true)).toBe(doc.content.size);
  });

  it("picks the top-level block for text inside a quote or table", () => {
    const e = mount("> q\n\n| a |\n| --- |\n| 1 |");
    expect(blockAt(e.state.doc, textPos(e, "q"))!.node.type.name).toBe("blockquote");
    expect(blockAt(e.state.doc, textPos(e, "1"))!.node.type.name).toBe("table");
  });
});
