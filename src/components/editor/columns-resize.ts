import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Column widths by dragging: while editing, the gap between two side-by-side columns holds
 * a vertical bar (`col-resize`). Dragging it moves the boundary in 5% steps, each column
 * keeping at least 15%; a double click makes the columns equal again. Widths live on the
 * `column` nodes (`width`, percent). No bars in the read view or when columns stack.
 */

const COLUMNS = "columns";
export const MIN_COLUMN_WIDTH = 15;
export const WIDTH_STEP = 5;
/** Hit area of the bar (px); the visible line inside is thinner (globals.css). */
const BAR_WIDTH = 8;
/** Transactions from a drag: the columns-editing lift skips them. */
export const COLUMN_RESIZE_META = "columnResize";

/** Each column's width in whole percents summing to 100 (equal shares when unset). */
export function columnWidths(columns: PMNode): number[] {
  const n = columns.childCount;
  const set: (number | null)[] = [];
  columns.forEach((c) => set.push((c.attrs.width as number | null) ?? null));
  if (n === 0) return [];
  const raw = set.every((w) => w !== null) ? (set as number[]) : set.map(() => 1);
  const total = raw.reduce((a, b) => a + b, 0);
  const out = raw.map((w) => Math.floor((w / total) * 100));
  out[n - 1] += 100 - out.reduce((a, b) => a + b, 0);
  return out;
}

/**
 * `widths` with the boundary after column `index` moved by `delta` percent: the left
 * column snaps to 5% steps, the pair keeps its total and neither drops below 15%.
 */
export function resizePair(widths: readonly number[], index: number, delta: number): number[] {
  const pair = widths[index] + widths[index + 1];
  if (!(pair >= 2 * MIN_COLUMN_WIDTH)) return [...widths];
  const snapped = Math.round((widths[index] + delta) / WIDTH_STEP) * WIDTH_STEP;
  const left = Math.min(Math.max(snapped, MIN_COLUMN_WIDTH), pair - MIN_COLUMN_WIDTH);
  const out = [...widths];
  out[index] = left;
  out[index + 1] = pair - left;
  return out;
}

/** Sets the widths of the columns block at `pos` (null each = equal). */
export function setColumnWidthsTr(
  state: EditorState,
  pos: number,
  widths: readonly (number | null)[],
): Transaction | null {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== COLUMNS || node.childCount !== widths.length) return null;
  const tr = state.tr;
  let changed = false;
  node.forEach((column, offset, i) => {
    if ((column.attrs.width ?? null) === widths[i]) return;
    tr.setNodeMarkup(pos + 1 + offset, undefined, { ...column.attrs, width: widths[i] });
    changed = true;
  });
  return changed ? tr.setMeta(COLUMN_RESIZE_META, true) : null;
}

const currentWidths = (node: PMNode) => {
  const out: (number | null)[] = [];
  node.forEach((c) => out.push((c.attrs.width as number | null) ?? null));
  return out;
};

type Bar = { el: HTMLElement; pos: number; index: number };
type Drag = {
  bar: Bar;
  node: PMNode;
  start: number[];
  original: (number | null)[];
  startX: number;
  /** Width (px) of all columns together, gaps excluded. */
  span: number;
  last: number[];
};

class ColumnResizeView {
  private bars: Bar[] = [];
  private drag: Drag | null = null;
  private frame = 0;
  private observer: ResizeObserver | null = null;

  constructor(private view: EditorView) {
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.schedule());
      this.observer.observe(view.dom);
    }
    window.addEventListener("resize", this.schedule);
    this.schedule();
  }

  update() {
    if (!this.drag) this.schedule();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    window.removeEventListener("resize", this.schedule);
    this.endDrag();
    for (const bar of this.bars) bar.el.remove();
    this.bars = [];
  }

  /** Bars sit beside the editor in its wrapper, like the block grip (drag-handle.ts). */
  private get host(): HTMLElement {
    const host = this.view.dom.parentElement ?? this.view.dom;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    return host;
  }

  private schedule = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.place());
  };

  /** One bar per boundary between side-by-side columns, placed over the gap. */
  private place() {
    const wanted: { pos: number; index: number; left: number; top: number; height: number }[] =
      [];
    if (this.view.editable && this.view.dom.isConnected) {
      const host = this.host.getBoundingClientRect();
      this.view.state.doc.forEach((node, pos) => {
        if (node.type.name !== COLUMNS) return;
        const dom = this.view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement) || getComputedStyle(dom).flexDirection === "column")
          return;
        const box = dom.getBoundingClientRect();
        const cols = [...dom.children].filter(
          (c): c is HTMLElement => c instanceof HTMLElement && c.dataset.type === "column",
        );
        for (let i = 0; i + 1 < cols.length; i++) {
          const a = cols[i].getBoundingClientRect();
          const b = cols[i + 1].getBoundingClientRect();
          wanted.push({
            pos,
            index: i,
            left: (a.right + b.left) / 2 - BAR_WIDTH / 2 - host.left,
            top: box.top - host.top,
            height: box.height,
          });
        }
      });
    }
    while (this.bars.length > wanted.length) this.bars.pop()!.el.remove();
    while (this.bars.length < wanted.length) this.bars.push(this.createBar());
    wanted.forEach((w, i) => {
      const bar = this.bars[i];
      bar.pos = w.pos;
      bar.index = w.index;
      if (bar.el.parentElement !== this.host) this.host.append(bar.el);
      bar.el.style.left = `${w.left}px`;
      bar.el.style.top = `${w.top}px`;
      bar.el.style.height = `${w.height}px`;
    });
  }

  private createBar(): Bar {
    const el = document.createElement("div");
    el.className = "rb-column-resize";
    el.dataset.testid = "column-resize-handle";
    el.setAttribute("role", "separator");
    el.setAttribute("aria-orientation", "vertical");
    el.setAttribute("aria-label", "열 너비 조절");
    el.contentEditable = "false";
    el.style.width = `${BAR_WIDTH}px`;
    const bar: Bar = { el, pos: -1, index: -1 };
    el.addEventListener("pointerdown", (e) => this.onDown(e, bar));
    el.addEventListener("dblclick", (e) => this.onReset(e, bar));
    return bar;
  }

  private columnsAt(bar: Bar): PMNode | null {
    const node = this.view.state.doc.nodeAt(bar.pos);
    return node && node.type.name === COLUMNS && bar.index + 1 < node.childCount ? node : null;
  }

  private onDown = (event: PointerEvent, bar: Bar) => {
    if (event.button !== 0 || !this.view.editable) return;
    const node = this.columnsAt(bar);
    const dom = this.view.nodeDOM(bar.pos);
    if (!node || !(dom instanceof HTMLElement)) return;
    event.preventDefault();
    const span = [...dom.children].reduce(
      (sum, c) =>
        c instanceof HTMLElement && c.dataset.type === "column"
          ? sum + c.getBoundingClientRect().width
          : sum,
      0,
    );
    if (span <= 0) return;
    const start = columnWidths(node);
    this.drag = {
      bar,
      node,
      start,
      original: currentWidths(node),
      startX: event.clientX,
      span,
      last: start,
    };
    bar.el.setPointerCapture(event.pointerId);
    bar.el.classList.add("rb-column-resize-active");
    document.body.classList.add("rb-column-resizing");
    bar.el.addEventListener("pointermove", this.onMove);
    bar.el.addEventListener("pointerup", this.onUp);
    bar.el.addEventListener("pointercancel", this.onUp);
  };

  private onMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag) return;
    const delta = ((event.clientX - drag.startX) / drag.span) * 100;
    const next = resizePair(drag.start, drag.bar.index, delta);
    if (next.every((w, i) => w === drag.last[i])) return;
    drag.last = next;
    // Live preview, kept out of the undo history; the drop records one step.
    const tr = setColumnWidthsTr(this.view.state, drag.bar.pos, next);
    if (tr) this.view.dispatch(tr.setMeta("addToHistory", false));
    this.place();
  };

  private onUp = () => {
    const drag = this.drag;
    if (!drag) return;
    this.endDrag();
    const moved = drag.last.some((w, i) => w !== drag.start[i]);
    if (!moved) return;
    // Back to the widths before the drag, then one undoable step to the new ones.
    const reset = setColumnWidthsTr(this.view.state, drag.bar.pos, drag.original);
    if (reset) this.view.dispatch(reset.setMeta("addToHistory", false));
    const tr = setColumnWidthsTr(this.view.state, drag.bar.pos, drag.last);
    if (tr) this.view.dispatch(tr);
    this.schedule();
  };

  private onReset = (event: MouseEvent, bar: Bar) => {
    if (!this.view.editable) return;
    event.preventDefault();
    const node = this.columnsAt(bar);
    if (!node) return;
    const tr = setColumnWidthsTr(
      this.view.state,
      bar.pos,
      currentWidths(node).map(() => null),
    );
    if (tr) this.view.dispatch(tr);
    this.schedule();
  };

  private endDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const el = drag.bar.el;
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.classList.remove("rb-column-resize-active");
    document.body.classList.remove("rb-column-resizing");
  }
}

export const ColumnResize = Extension.create({
  name: "columnResize",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("columnResize"),
        view: (view) => new ColumnResizeView(view),
      }),
    ];
  },
});
