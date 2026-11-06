/**
 * Markdown for column blocks (kept free of markdown-it imports: the parser instance comes
 * from tiptap-markdown). A block of 2–3 columns is stored as
 *
 *     ::: columns
 *     ::: column
 *     left side
 *     :::
 *     ::: column
 *     right side
 *     :::
 *     :::
 *
 * Only a complete, well-formed group (2–3 columns, every marker on its own line, outside
 * code fences) is read as columns; anything else stays ordinary text, so existing notes
 * that happen to contain `:::` read exactly as before.
 */

export const COLUMNS_OPEN = "::: columns";
export const COLUMN_OPEN = "::: column";
export const COLUMN_CLOSE = ":::";
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 3;

type Token = {
  block: boolean;
  map: [number, number] | null;
  attrSet(name: string, value: string): void;
};
type BlockState = {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  sCount: number[];
  blkIndent: number;
  line: number;
  lineMax: number;
  parentType: string;
  push(type: string, tag: string, nesting: number): Token;
  md: { block: { tokenize(state: BlockState, start: number, end: number): void } };
};
type BlockRule = (
  state: BlockState,
  startLine: number,
  endLine: number,
  silent: boolean,
) => boolean;
export type MarkdownItBlockLike = {
  block: {
    ruler: {
      before(name: string, rule: string, fn: BlockRule, options?: { alt: string[] }): void;
    };
  };
};

const MARKERS = new Set([COLUMNS_OPEN, COLUMN_OPEN, COLUMN_CLOSE]);

/**
 * Column Markdown with `\` before every line (outside code fences) that would otherwise read
 * as a marker: text typed as `:::` or `::: column` inside a column. Markdown reads `\:` back
 * as `:`, so the text survives a round trip without ending the column. Leading spaces are
 * ignored here as in `scan`, so list continuation lines are covered too.
 */
export function escapeMarkerLines(markdown: string): string {
  let fence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (fence) {
        if (t.startsWith(fence) && /^[`~]*$/.test(t)) fence = null;
        return line;
      }
      const open = /^(`{3,}|~{3,})/.exec(t);
      if (open) fence = open[1];
      else if (MARKERS.has(t)) return line.replace(":", "\\:");
      return line;
    })
    .join("\n");
}

const lineText = (state: BlockState, line: number) =>
  state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trimEnd();

/** Content line ranges `[start, end)` of each column, and the line of the final `:::`. */
type Layout = { columns: [number, number][]; last: number };

function scan(state: BlockState, startLine: number, endLine: number): Layout | null {
  const columns: [number, number][] = [];
  let line = startLine + 1;
  while (line < endLine) {
    const text = lineText(state, line);
    if (text === COLUMN_CLOSE) {
      if (columns.length < MIN_COLUMNS) return null;
      return { columns, last: line };
    }
    if (text !== COLUMN_OPEN || columns.length === MAX_COLUMNS) return null;
    const start = line + 1;
    let fence: string | null = null;
    let end = -1;
    for (let l = start; l < endLine; l++) {
      const t = lineText(state, l);
      if (fence) {
        if (t.startsWith(fence) && /^[`~]*$/.test(t)) fence = null;
        continue;
      }
      const open = /^(`{3,}|~{3,})/.exec(t);
      if (open) fence = open[1];
      else if (t === COLUMN_CLOSE) {
        end = l;
        break;
      } else if (t === COLUMNS_OPEN || t === COLUMN_OPEN) return null; // no nesting
    }
    if (end < 0) return null;
    columns.push([start, end]);
    line = end + 1;
  }
  return null;
}

const columnsRule: BlockRule = (state, startLine, endLine, silent) => {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (lineText(state, startLine) !== COLUMNS_OPEN) return false;
  const layout = scan(state, startLine, endLine);
  if (!layout) return false;
  if (silent) return true;

  const oldParent = state.parentType;
  const oldMax = state.lineMax;
  state.parentType = "columns";
  const open = state.push("columns_open", "div", 1);
  open.block = true;
  open.map = [startLine, layout.last + 1];
  open.attrSet("data-type", "columns");
  for (const [start, end] of layout.columns) {
    const col = state.push("column_open", "div", 1);
    col.block = true;
    col.map = [start - 1, end + 1];
    col.attrSet("data-type", "column");
    state.lineMax = end;
    state.md.block.tokenize(state, start, end);
    state.lineMax = oldMax;
    state.push("column_close", "div", -1).block = true;
  }
  state.push("columns_close", "div", -1).block = true;
  state.parentType = oldParent;
  state.lineMax = oldMax;
  state.line = layout.last + 1;
  return true;
};

const INSTALLED = Symbol.for("rb.columns");

/**
 * Block rule reading `::: columns` groups as `<div data-type="columns">` with one
 * `<div data-type="column">` per column (markdown-it's default renderer writes the tags).
 * tiptap-markdown runs `setup` before every parse, so installing twice is a no-op.
 */
export function columnsPlugin(md: MarkdownItBlockLike): void {
  const flagged = md as MarkdownItBlockLike & { [INSTALLED]?: true };
  if (flagged[INSTALLED]) return;
  flagged[INSTALLED] = true;
  md.block.ruler.before("fence", "rb_columns", columnsRule);
}
