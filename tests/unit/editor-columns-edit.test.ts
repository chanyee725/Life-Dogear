// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { insertColumns, removeEmptyColumnTr } from "@/components/editor/columns-edit";
import { blockAt, dropPosition, moveBlock } from "@/components/editor/drag-handle";
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

const cols = (...columns: string[]) =>
  ["::: columns", ...columns.flatMap((c) => ["::: column", ...(c ? [c] : []), ":::"]), ":::"].join(
    "\n",
  );

/** Position of the first text matching `text`. */
function textPos(e: Editor, text: string) {
  let found = -1;
  e.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text?.includes(text)) found = pos;
  });
  if (found < 0) throw new Error(`no ${text}`);
  return found;
}

function cursor(e: Editor, pos: number) {
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, pos)));
}

/** Text start of the paragraph in column `index` (0-based) of the first columns block. */
function columnStart(e: Editor, index: number) {
  const columns = e.state.doc.firstChild!;
  let pos = 1;
  for (let i = 0; i < index; i++) pos += columns.child(i).nodeSize;
  return pos + 2;
}

function backspace(e: Editor) {
  const tr = removeEmptyColumnTr(e.state);
  if (!tr) return false;
  e.view.dispatch(tr);
  return true;
}

describe("insertColumns", () => {
  it("replaces the empty paragraph with 2 columns and puts the cursor in the first", () => {
    const e = mount("");
    expect(insertColumns(e, 2)).toBe(true);
    const block = e.state.doc.firstChild!;
    expect(block.type.name).toBe("columns");
    expect(block.childCount).toBe(2);
    // StarterKit's TrailingNode keeps an empty paragraph after the block.
    expect(e.state.doc.childCount).toBe(2);
    expect(e.state.selection.$from.node(-1).type.name).toBe("column");
    expect(e.state.selection.$from.index(1)).toBe(0);
    e.commands.insertContent("left");
    expect(md(e)).toBe(cols("left", ""));
  });

  it("goes below a non-empty paragraph, with 3 columns", () => {
    const e = mount("intro");
    cursor(e, 3);
    insertColumns(e, 3);
    expect(e.state.doc.child(0).textContent).toBe("intro");
    expect(e.state.doc.child(1).type.name).toBe("columns");
    expect(e.state.doc.child(1).childCount).toBe(3);
  });

  it("stays while empty with the cursor in it, lifts once the cursor leaves", () => {
    const e = mount("intro");
    cursor(e, 3);
    insertColumns(e, 2);
    expect(e.state.doc.child(1).type.name).toBe("columns");
    cursor(e, 3);
    expect(e.state.doc.child(1).type.name).toBe("paragraph");
    expect(e.state.doc.textContent).toBe("intro");
    e.state.doc.forEach((n) => expect(n.type.name).toBe("paragraph"));
  });
});

describe("Backspace in an empty column", () => {
  it("lifts the other column's blocks when one column would be left", () => {
    const e = mount(cols("left\n\nmore", ""));
    cursor(e, columnStart(e, 1));
    expect(backspace(e)).toBe(true);
    expect(e.state.doc.firstChild!.type.name).toBe("paragraph");
    expect(md(e)).toBe("left\n\nmore");
    expect(e.state.selection.$from.parent.textContent).toBe("more");
  });

  it("drops just that column when two non-empty columns are left", () => {
    const e = mount(cols("a", "", "c"));
    cursor(e, columnStart(e, 1));
    backspace(e);
    expect(md(e)).toBe(cols("a", "c"));
    expect(e.state.selection.$from.parent.textContent).toBe("a");
  });

  it("turns all-empty columns into one empty paragraph", () => {
    const e = mount("");
    insertColumns(e, 3);
    backspace(e);
    e.state.doc.forEach((n) => expect(n.type.name).toBe("paragraph"));
  });

  it("leaves a column with text alone", () => {
    const e = mount(cols("a", "b"));
    cursor(e, columnStart(e, 1));
    expect(backspace(e)).toBe(false);
  });
});

describe("dragging with columns", () => {
  it("moves the whole columns block from the first column", () => {
    const e = mount(`${cols("a", "b")}\n\nafter`);
    const block = blockAt(e.state.doc, textPos(e, "a"));
    expect(block?.node.type.name).toBe("columns");
    const after = e.state.doc.child(1);
    const to = dropPosition(e.state.doc, block!, { pos: block!.node.nodeSize, node: after }, true);
    e.view.dispatch(moveBlock(e.state, block!.pos, to!)!);
    expect(md(e)).toBe(`after\n\n${cols("a", "b")}`);
  });

  it("moves a block from the second column into the first, keeping an empty line", () => {
    const e = mount(cols("a", "b"));
    const block = blockAt(e.state.doc, textPos(e, "b"));
    expect(block?.node.type.name).toBe("paragraph");
    const target = blockAt(e.state.doc, textPos(e, "a"))!;
    expect(target.node.type.name).toBe("columns");
    const a = { pos: textPos(e, "a") - 1, node: e.state.doc.nodeAt(textPos(e, "a") - 1)! };
    const to = dropPosition(e.state.doc, block!, a, true);
    expect(to).not.toBeNull();
    e.view.dispatch(moveBlock(e.state, block!.pos, to!)!);
    const saved = md(e);
    expect(saved).toBe(cols("a\n\nb", ""));
    expect(md(mount(saved))).toBe(saved);
  });

  it("does not drop a column block among top-level blocks", () => {
    const e = mount(`${cols("a", "b")}\n\nafter`);
    const block = blockAt(e.state.doc, textPos(e, "b"))!;
    const after = e.state.doc.child(1);
    const pos = e.state.doc.child(0).nodeSize;
    expect(dropPosition(e.state.doc, block, { pos, node: after }, true)).toBeNull();
  });
});
