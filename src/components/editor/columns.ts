import { Node, type CommandProps } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import {
  columnOpenLine,
  columnsPlugin,
  escapeMarkerLines,
  parseColumnWidth,
  COLUMN_CLOSE,
  COLUMNS_OPEN,
  MAX_COLUMNS,
  MIN_COLUMNS,
  type MarkdownItBlockLike,
} from "./columns-markdown";

/**
 * Notion-style columns: a `columns` block holds 2–3 `column`s side by side, each holding
 * any blocks (lists, code, photos, tables…). Below the `md` breakpoint they stack. Stored
 * in Markdown as `::: columns` / `::: column` / `:::` lines (see `columns-markdown`).
 * A column's `width` (percent, null = equal share) is dragged in `columns-resize` and only
 * applies side by side (globals.css).
 */

export const COLUMNS = "columns";
export const COLUMN = "column";
/**
 * Group of `columns` instead of `block`: a column holds `block+`, so columns cannot sit in
 * a column (nor in lists, quotes or table cells) — not by typing, dragging or pasting HTML.
 * Only the document accepts it (see `ColumnsDocument`).
 */
export const TOP_BLOCK = "topBlock";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      /** Inserts `count` (2–3) empty columns at the cursor and puts the cursor in the first. */
      insertColumns: (count: number) => ReturnType;
    };
  }
}

type SerializerState = {
  out: string;
  write(content?: string): void;
  ensureNewLine(): void;
  flushClose(size?: number): void;
  renderContent(parent: PMNode): void;
  closeBlock(node: PMNode): void;
};

/** Whether `node` is an empty column (one empty paragraph). */
export function isEmptyColumn(node: PMNode): boolean {
  return (
    node.type.name === COLUMN &&
    node.childCount === 1 &&
    node.firstChild!.isTextblock &&
    node.firstChild!.content.size === 0
  );
}

/** Depth of the closest `column` around `$pos`, or -1. */
function columnDepth(state: EditorState): number {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === COLUMN) return d;
  return -1;
}

/**
 * Inserts a columns block with `count` empty columns and puts the cursor in the first.
 * It replaces the empty paragraph the cursor is in, else goes below the cursor's block
 * (below the top-level block inside a list or quote). Null for a bad count.
 *
 * The `insertColumns` command refuses inside a column. With `fromSlash` (the slash menu)
 * any empty textblock is replaced, and inside a column the new block goes below the
 * enclosing columns block instead.
 */
export function insertColumnsTr(
  state: EditorState,
  count: number,
  { fromSlash = false }: { fromSlash?: boolean } = {},
): Transaction | null {
  if (count < MIN_COLUMNS || count > MAX_COLUMNS) return null;
  if (!fromSlash && columnDepth(state) >= 0) return null; // no columns inside columns
  const { schema } = state;
  const columns = schema.nodes[COLUMNS].create(
    null,
    Array.from({ length: count }, () =>
      schema.nodes[COLUMN].create(null, schema.nodes.paragraph.create()),
    ),
  );
  const { $from } = state.selection;
  const tr = state.tr;
  let at: number;
  const block = $from.parent;
  const depth = $from.depth;
  const container = $from.node(depth - 1);
  const index = $from.index(depth - 1);
  if (
    depth >= 1 &&
    (fromSlash ? block.isTextblock : block.type.name === "paragraph") &&
    block.content.size === 0 &&
    container.canReplaceWith(index, index + 1, columns.type)
  ) {
    at = $from.before(depth);
    tr.replaceWith(at, $from.after(depth), columns);
  } else if (depth >= 1 && container.canReplaceWith(index + 1, index + 1, columns.type)) {
    at = $from.after(depth);
    tr.insert(at, columns);
  } else {
    // Inside a list or quote: the columns go after the top-level block.
    at = $from.after(1);
    tr.insert(at, columns);
  }
  // columns → column → paragraph: the first column's paragraph starts 3 positions in.
  tr.setSelection(TextSelection.create(tr.doc, at + 3));
  return tr.scrollIntoView();
}

export const Column = Node.create({
  name: COLUMN,
  content: "block+",
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => parseColumnWidth(element.getAttribute("data-width")),
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = attributes.width as number | null;
          return width ? { "data-width": String(width), style: `--rb-col-w: ${width}` } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        ...HTMLAttributes,
        "data-type": COLUMN,
        class: "rb-column min-w-0 flex-1 [&>*+*]:mt-[0.6em]",
      },
      0,
    ];
  },

  addStorage() {
    return {
      // Written by `columns` itself.
      markdown: { serialize() {} },
    };
  },
});

export const Columns = Node.create({
  name: COLUMNS,
  group: TOP_BLOCK,
  content: `${COLUMN}{${MIN_COLUMNS},${MAX_COLUMNS}}`,
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },

  renderHTML() {
    return [
      "div",
      {
        "data-type": COLUMNS,
        class: "rb-columns flex flex-col gap-y-[0.6em] md:flex-row md:gap-x-8",
      },
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: PMNode) {
          state.write(COLUMNS_OPEN);
          state.ensureNewLine();
          node.forEach((column) => {
            state.write(columnOpenLine(column.attrs.width as number | null));
            state.ensureNewLine();
            const from = state.out.length;
            state.renderContent(column);
            state.flushClose(1);
            state.out = state.out.slice(0, from) + escapeMarkerLines(state.out.slice(from));
            state.write(COLUMN_CLOSE);
            state.ensureNewLine();
          });
          state.write(COLUMN_CLOSE);
          state.closeBlock(node);
        },
        parse: {
          setup(md: MarkdownItBlockLike) {
            columnsPlugin(md);
          },
        },
      },
    };
  },

  addCommands() {
    return {
      insertColumns:
        (count: number) =>
        ({ state, dispatch }: CommandProps) => {
          const tr = insertColumnsTr(state, count);
          if (!tr) return false;
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
