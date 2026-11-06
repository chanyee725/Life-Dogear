import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";

/**
 * Editing behaviour for the `columns` / `column` blocks (schema in ./columns):
 * inserting them from the slash menu, Backspace in an empty column removing it, and
 * lifting a columns block back to plain blocks when an edit leaves it a single column, or
 * every column empty with the cursor outside it.
 */

const COLUMNS = "columns";
const COLUMN = "column";

/** A column holding nothing but one empty textblock. */
export function isEmptyColumn(column: PMNode): boolean {
  const only = column.childCount === 1 ? column.firstChild : null;
  return !!only && only.isTextblock && only.content.size === 0;
}

/**
 * Inserts a columns block with `count` empty columns as a top-level block: it replaces
 * the empty paragraph the cursor is in, else goes below the cursor's top-level block.
 * The cursor lands in the first column. False when the schema has no columns.
 */
export function insertColumnsTr(state: EditorState, count: number): Transaction | null {
  const { columns, column, paragraph } = state.schema.nodes;
  if (!columns || !column || !paragraph) return null;
  const node = columns.createAndFill(
    null,
    Array.from({ length: count }, () => column.create(null, paragraph.create())),
  );
  if (!node) return null;
  const { $from, to } = state.selection;
  const tr = state.tr;
  let at: number;
  if ($from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0) {
    at = $from.before(1);
    tr.replaceWith(at, $from.after(1), node);
  } else {
    at = $from.depth >= 1 ? $from.after(1) : to;
    tr.insert(at, node);
  }
  // columns > column > paragraph: the first column's text starts three steps in.
  tr.setSelection(TextSelection.create(tr.doc, at + 3));
  return tr.scrollIntoView();
}

export function insertColumns(editor: Editor, count: number): boolean {
  const tr = insertColumnsTr(editor.state, count);
  if (!tr) return false;
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

/** What a columns block becomes when lifted: the one column's blocks, or an empty paragraph. */
function liftedContent(state: EditorState, columns: readonly PMNode[]): Fragment {
  const kept = columns.filter((c) => !isEmptyColumn(c));
  if (kept.length === 0) return Fragment.from(state.schema.nodes.paragraph.create());
  let out = Fragment.empty;
  for (const c of kept) out = out.append(c.content);
  return out;
}

/**
 * Backspace at the start of an empty column: the column goes. With one column left (or
 * only empty ones) the columns block turns back into plain blocks.
 */
export function removeEmptyColumnTr(state: EditorState): Transaction | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const d = $from.depth;
  if (d < 3 || $from.parentOffset !== 0 || $from.parent.content.size !== 0) return null;
  const column = $from.node(d - 1);
  const columns = $from.node(d - 2);
  if (column.type.name !== COLUMN || columns.type.name !== COLUMNS || !isEmptyColumn(column))
    return null;
  const index = $from.index(d - 2);
  const rest: PMNode[] = [];
  columns.forEach((c, _, i) => {
    if (i !== index) rest.push(c);
  });
  const tr = state.tr;
  if (rest.length >= 2 && rest.some((c) => !isEmptyColumn(c))) {
    const colFrom = $from.before(d - 1);
    tr.delete(colFrom, $from.after(d - 1));
    // Into the end of the column before (or the start of the one that moved up).
    const near = index > 0 ? TextSelection.near(tr.doc.resolve(colFrom - 1), -1) : null;
    tr.setSelection(near ?? TextSelection.near(tr.doc.resolve(colFrom + 1)));
    return tr.scrollIntoView();
  }
  const from = $from.before(d - 2);
  const content = liftedContent(state, rest);
  tr.replaceWith(from, from + columns.nodeSize, content);
  const end = from + content.size;
  tr.setSelection(
    index > 0
      ? TextSelection.near(tr.doc.resolve(end), -1)
      : TextSelection.near(tr.doc.resolve(from)),
  );
  return tr.scrollIntoView();
}

/** Ranges `trs` changed, in the final document's positions. */
function changedRanges(trs: readonly Transaction[]): [number, number][] {
  let ranges: [number, number][] = [];
  for (const tr of trs) {
    if (!tr.docChanged) continue;
    for (const map of tr.mapping.maps) {
      ranges = ranges.map(([a, b]) => [map.map(a, -1), map.map(b, 1)]);
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        ranges.push([newStart, newEnd]);
      });
    }
  }
  return ranges;
}

/**
 * Lifts top-level columns blocks that `ranges` touch and are no longer columns: fewer
 * than two columns, or every column empty while the cursor is outside the block (a
 * fresh, still empty block the cursor sits in stays). Untouched blocks are left alone,
 * so opening a note or moving the cursor never rewrites it. Runs back to front so
 * earlier positions stay valid.
 */
export function liftStaleColumnsTr(
  state: EditorState,
  ranges: readonly [number, number][],
): Transaction | null {
  if (ranges.length === 0) return null;
  const found: { pos: number; node: PMNode }[] = [];
  const { from, to } = state.selection;
  state.doc.forEach((node, pos) => {
    if (node.type.name !== COLUMNS) return;
    const end = pos + node.nodeSize;
    if (!ranges.some(([a, b]) => a <= end && b >= pos)) return;
    const children: PMNode[] = [];
    node.forEach((c) => children.push(c));
    const inside = from > pos && to < end;
    if (node.childCount < 2 || (!inside && children.every(isEmptyColumn)))
      found.push({ pos, node });
  });
  if (found.length === 0) return null;
  const tr = state.tr;
  for (const { pos, node } of found.reverse()) {
    const children: PMNode[] = [];
    node.forEach((c) => children.push(c));
    tr.replaceWith(pos, pos + node.nodeSize, liftedContent(state, children));
  }
  return tr;
}

export const ColumnsEditing = Extension.create({
  name: "columnsEditing",
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const tr = removeEmptyColumnTr(editor.state);
        if (!tr) return false;
        editor.view.dispatch(tr);
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("columnsEditing"),
        appendTransaction: (trs, _old, state) => {
          // Only edits: a cursor move alone must not change (and so save) the note.
          if (!state.schema.nodes[COLUMNS] || !trs.some((tr) => tr.docChanged)) return null;
          return liftStaleColumnsTr(state, changedRanges(trs));
        },
      }),
    ];
  },
});
