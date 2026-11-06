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
 * A column may carry its width in percent after the marker (`::: column 40`); a column
 * without one shares the row equally, and its line is written exactly as above.
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

/** Widths a column may store: whole percents. */
export const MIN_WIDTH = 1;
export const MAX_WIDTH = 100;

/** `value` as a column width (a whole number 1–100), else null. */
export function parseColumnWidth(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= MIN_WIDTH && n <= MAX_WIDTH ? n : null;
}

/** The `::: column` line for a column of `width` (none for an equal share). */
export function columnOpenLine(width: number | null | undefined): string {
  return width ? `${COLUMN_OPEN} ${width}` : COLUMN_OPEN;
}

/**
 * For a `::: column` line (trimmed): its width, or null for none. Undefined when `text` is
 * not a column marker, including a bad width (`::: column abc`, `::: column 0`).
 */
function columnOpen(text: string): number | null | undefined {
  if (text === COLUMN_OPEN) return null;
  if (!text.startsWith(`${COLUMN_OPEN} `)) return undefined;
  return parseColumnWidth(text.slice(COLUMN_OPEN.length + 1)) ?? undefined;
}

const isMarker = (text: string) =>
  text === COLUMNS_OPEN || text === COLUMN_CLOSE || columnOpen(text) !== undefined;

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
      else if (isMarker(t)) return line.replace(":", "\\:");
      return line;
    })
    .join("\n");
}

const lineText = (state: BlockState, line: number) =>
  state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trimEnd();

/** Each column's content lines `[start, end)` and width, and the line of the final `:::`. */
type Layout = { columns: { start: number; end: number; width: number | null }[]; last: number };

function scan(state: BlockState, startLine: number, endLine: number): Layout | null {
  const columns: Layout["columns"] = [];
  let line = startLine + 1;
  while (line < endLine) {
    const text = lineText(state, line);
    if (text === COLUMN_CLOSE) {
      if (columns.length < MIN_COLUMNS) return null;
      return { columns, last: line };
    }
    const width = columnOpen(text);
    if (width === undefined || columns.length === MAX_COLUMNS) return null;
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
      } else if (t === COLUMNS_OPEN || columnOpen(t) !== undefined) return null; // no nesting
    }
    if (end < 0) return null;
    columns.push({ start, end, width });
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
  for (const { start, end, width } of layout.columns) {
    const col = state.push("column_open", "div", 1);
    col.block = true;
    col.map = [start - 1, end + 1];
    col.attrSet("data-type", "column");
    if (width !== null) col.attrSet("data-width", String(width));
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
