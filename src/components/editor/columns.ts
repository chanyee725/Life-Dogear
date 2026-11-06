import { Node, type CommandProps } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import {
  columnsPlugin,
  COLUMN_CLOSE,
  COLUMN_OPEN,
  COLUMNS_OPEN,
  MAX_COLUMNS,
  MIN_COLUMNS,
  type MarkdownItBlockLike,
} from "./columns-markdown";

/**
 * Notion-style columns: a `columns` block holds 2–3 `column`s side by side, each holding
 * any blocks (lists, code, photos, tables…). Below the `md` breakpoint they stack. Stored
 * in Markdown as `::: columns` / `::: column` / `:::` lines (see `columns-markdown`).
 */

export const COLUMNS = "columns";
export const COLUMN = "column";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      /** Inserts `count` (2–3) empty columns at the cursor and puts the cursor in the first. */
      insertColumns: (count: number) => ReturnType;
    };
  }
}

type SerializerState = {
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

export function insertColumnsTr(state: EditorState, count: number): Transaction | null {
  if (count < MIN_COLUMNS || count > MAX_COLUMNS) return null;
  if (columnDepth(state) >= 0) return null; // no columns inside columns
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
    block.type.name === "paragraph" &&
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

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML() {
    return [
      "div",
      {
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
  group: "block",
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
            state.write(COLUMN_OPEN);
            state.ensureNewLine();
            state.renderContent(column);
            state.flushClose(1);
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
