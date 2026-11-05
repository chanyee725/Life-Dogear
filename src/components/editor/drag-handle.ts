import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Notion-style block handle: hovering a block shows a ⋮⋮ grip in the left margin.
 * Dragging the grip moves the block (a drop line marks where it lands); clicking it
 * selects the block so the keyboard can delete or copy it. List and task items move
 * as single items; every other block moves as a whole top-level block (a table, a
 * quote, a code block, a photo). Hidden while the editor is read-only. On touch the
 * grip has to be held briefly before it drags.
 */

const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);
const ITEM_TYPES = new Set(["listItem", "taskItem"]);
/** Pointer travel (px) before a press on the grip becomes a drag. */
const DRAG_SLOP = 4;
/** Touch hold (ms) before the grip drags, so a swipe over it still scrolls the page. */
const LONG_PRESS_MS = 300;
const HANDLE_SIZE = 20;

export type Block = { pos: number; node: PMNode };

/**
 * Moves the block that starts at `from` to the boundary `to` (a position between two
 * sibling blocks, in the original document). Returns null when nothing would change.
 */
export function moveBlock(state: EditorState, from: number, to: number): Transaction | null {
  const node = state.doc.nodeAt(from);
  if (!node) return null;
  const end = from + node.nodeSize;
  if (to >= from && to <= end) return null;
  const tr = state.tr.delete(from, end);
  const insertAt = tr.mapping.map(to);
  tr.insert(insertAt, node);
  tr.setSelection(NodeSelection.create(tr.doc, insertAt));
  return tr.scrollIntoView();
}

/** The draggable block around `pos`: the innermost list item, else the top-level block. */
export function blockAt(doc: PMNode, pos: number, inside = -1): Block | null {
  if (inside >= 0) {
    const node = doc.nodeAt(inside);
    const $inside = doc.resolve(inside);
    if (node?.isBlock && (ITEM_TYPES.has(node.type.name) || $inside.depth === 0))
      return { pos: inside, node };
  }
  const $pos = doc.resolve(Math.min(Math.max(pos, 0), doc.content.size));
  for (let d = $pos.depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (ITEM_TYPES.has(node.type.name) || d === 1) return { pos: $pos.before(d), node };
  }
  return null;
}

/**
 * Where `dragged` may land near `pos`: a sibling boundary in a parent that can hold it.
 * Top-level blocks stay top-level; list items go into lists that accept them.
 * `after` picks the boundary below the hovered block instead of above it.
 */
export function dropPosition(
  doc: PMNode,
  dragged: Block,
  hover: Block,
  after: boolean,
): number | null {
  const $hover = doc.resolve(hover.pos);
  const parent = $hover.parent;
  const sourceParent = doc.resolve(dragged.pos).parent;
  const sameKind =
    parent.type === sourceParent.type ||
    (LIST_TYPES.has(parent.type.name) && LIST_TYPES.has(sourceParent.type.name));
  const index = $hover.index() + (after ? 1 : 0);
  if (!sameKind || !parent.canReplaceWith(index, index, dragged.node.type)) return null;
  const to = after ? hover.pos + hover.node.nodeSize : hover.pos;
  if (to >= dragged.pos && to <= dragged.pos + dragged.node.nodeSize) return null;
  return to;
}

/** Hovered blocks that could receive `dragged`, innermost first. */
function candidates(doc: PMNode, pos: number, inside: number): Block[] {
  const out: Block[] = [];
  const base = inside >= 0 ? inside : pos;
  const insideNode = inside >= 0 ? doc.nodeAt(inside) : null;
  if (insideNode?.isBlock) out.push({ pos: inside, node: insideNode });
  const $pos = doc.resolve(base);
  for (let d = $pos.depth; d >= 1; d--) out.push({ pos: $pos.before(d), node: $pos.node(d) });
  return out;
}

const GRIP_SVG =
  '<svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" fill="currentColor">' +
  '<circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/>' +
  '<circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/>' +
  '<circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';

class DragHandleView {
  private handle: HTMLButtonElement;
  private line: HTMLDivElement;
  private block: Block | null = null;
  private drag: {
    block: Block;
    dom: HTMLElement | null;
    startX: number;
    startY: number;
    active: boolean;
    armed: boolean;
    timer?: ReturnType<typeof setTimeout>;
    to: number | null;
  } | null = null;

  private hideTimer?: ReturnType<typeof setTimeout>;

  constructor(private view: EditorView) {

    this.handle = document.createElement("button");
    this.handle.type = "button";
    this.handle.className = "rb-drag-handle";
    this.handle.setAttribute("aria-label", "블록 이동");
    this.handle.tabIndex = -1;
    this.handle.contentEditable = "false";
    this.handle.innerHTML = GRIP_SVG;
    this.handle.hidden = true;

    this.line = document.createElement("div");
    this.line.className = "rb-drop-line";
    this.line.hidden = true;

    view.dom.addEventListener("mousemove", this.onHover);
    view.dom.addEventListener("mouseleave", this.onLeave);
    this.handle.addEventListener("mouseenter", () => clearTimeout(this.hideTimer));
    this.handle.addEventListener("mouseleave", this.onLeave);
    this.handle.addEventListener("pointerdown", this.onDown);
    this.handle.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  update() {
    if (!this.view.editable) this.hide();
    else if (this.block && !this.drag) this.place(this.block);
  }

  destroy() {
    this.endDrag();
    clearTimeout(this.hideTimer);
    this.view.dom.removeEventListener("mousemove", this.onHover);
    this.view.dom.removeEventListener("mouseleave", this.onLeave);
    this.handle.remove();
    this.line.remove();
  }

  /**
   * The grip and drop line sit beside the editor in its wrapper (Tiptap's EditorContent
   * moves the editor's siblings along when it mounts), positioned against that wrapper.
   */
  private get host(): HTMLElement {
    const host = this.view.dom.parentElement ?? this.view.dom;
    if (this.handle.parentElement !== host) {
      host.append(this.handle, this.line);
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
    }
    return host;
  }

  private hide() {
    clearTimeout(this.hideTimer);
    this.handle.hidden = true;
    this.block = null;
  }

  private blockDom(block: Block): HTMLElement | null {
    const dom = this.view.nodeDOM(block.pos);
    return dom instanceof HTMLElement ? dom : null;
  }

  private onHover = (event: MouseEvent) => {
    if (this.drag || !this.view.editable) return;
    clearTimeout(this.hideTimer);
    const content = this.view.dom.getBoundingClientRect();
    // The margin left of the text maps to the block beside it, so the grip stays reachable.
    const left = Math.max(event.clientX, content.left + 1);
    const hit = this.view.posAtCoords({ left, top: event.clientY });
    const block = hit && blockAt(this.view.state.doc, hit.pos, hit.inside);
    if (!block) return this.hide();
    this.block = block;
    this.place(block);
  };

  /** Leaving the text for the grip crosses a small gap, so hiding waits a moment. */
  private onLeave = (event: MouseEvent) => {
    if (this.drag || this.handle.contains(event.relatedTarget as Node | null)) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 400);
  };

  private place(block: Block) {
    const dom = this.blockDom(block);
    if (!dom) return this.hide();
    const rect = dom.getBoundingClientRect();
    const host = this.host.getBoundingClientRect();
    const style = getComputedStyle(dom);
    const lineHeight = parseFloat(style.lineHeight) || 24;
    const firstLine = Math.min(lineHeight, rect.height);
    // Bullets and numbers sit left of the item; keep the grip clear of them.
    const parent = this.view.state.doc.resolve(block.pos).parent.type.name;
    const marker = parent === "bulletList" || parent === "orderedList" ? 18 : 0;
    this.handle.style.top = `${rect.top - host.top + firstLine / 2 - HANDLE_SIZE / 2}px`;
    this.handle.style.left = `${rect.left - host.left - marker - HANDLE_SIZE - 4}px`;
    this.handle.hidden = false;
  }

  private onDown = (event: PointerEvent) => {
    if (event.button !== 0 || !this.block || !this.view.editable) return;
    event.preventDefault();
    this.handle.setPointerCapture(event.pointerId);
    const touch = event.pointerType === "touch";
    this.drag = {
      block: this.block,
      dom: this.blockDom(this.block),
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      armed: !touch,
      to: null,
    };
    if (touch) {
      this.drag.timer = setTimeout(() => {
        if (!this.drag) return;
        this.drag.armed = true;
        this.startDrag();
      }, LONG_PRESS_MS);
    }
    this.handle.addEventListener("pointermove", this.onMove);
    this.handle.addEventListener("pointerup", this.onUp);
    this.handle.addEventListener("pointercancel", this.onCancel);
  };

  private startDrag() {
    if (!this.drag || this.drag.active) return;
    this.drag.active = true;
    this.drag.dom?.classList.add("rb-dragging");
    document.body.classList.add("rb-block-dragging");
  }

  private onMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag) return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active) {
      if (moved < DRAG_SLOP) return;
      if (!drag.armed) return this.endDrag(); // touch moved before the hold: let it scroll
      this.startDrag();
    }
    drag.to = this.target(drag.block, event.clientX, event.clientY);
  };

  /** Finds the drop boundary under the pointer and draws the line there. */
  private target(dragged: Block, x: number, y: number): number | null {
    const content = this.view.dom.getBoundingClientRect();
    const left = Math.min(Math.max(x, content.left + 1), content.right - 1);
    const top = Math.min(Math.max(y, content.top + 1), content.bottom - 1);
    const hit = this.view.posAtCoords({ left, top });
    const { doc } = this.view.state;
    if (hit) {
      for (const hover of candidates(doc, hit.pos, hit.inside)) {
        const dom = this.blockDom(hover);
        if (!dom) continue;
        const rect = dom.getBoundingClientRect();
        const after = y > rect.top + rect.height / 2;
        const to = dropPosition(doc, dragged, hover, after);
        if (to === null) continue;
        this.showLine(rect, after);
        return to;
      }
    }
    this.line.hidden = true;
    return null;
  }

  private showLine(rect: DOMRect, after: boolean) {
    const host = this.host.getBoundingClientRect();
    this.line.style.top = `${(after ? rect.bottom : rect.top) - host.top - 1}px`;
    this.line.style.left = `${rect.left - host.left}px`;
    this.line.style.width = `${rect.width}px`;
    this.line.hidden = false;
  }

  private onUp = () => {
    const drag = this.drag;
    if (!drag) return;
    if (drag.active) {
      if (drag.to !== null) {
        const tr = moveBlock(this.view.state, drag.block.pos, drag.to);
        if (tr) this.view.dispatch(tr);
      }
    } else {
      // A click on the grip selects the block (Delete, ⌘C and ⌘X then act on it).
      const tr = this.view.state.tr.setSelection(
        NodeSelection.create(this.view.state.doc, drag.block.pos),
      );
      this.view.dispatch(tr);
    }
    this.endDrag();
    this.hide();
    this.view.focus();
  };

  private onCancel = () => this.endDrag();

  private endDrag() {
    const drag = this.drag;
    if (!drag) return;
    clearTimeout(drag.timer);
    drag.dom?.classList.remove("rb-dragging");
    document.body.classList.remove("rb-block-dragging");
    this.line.hidden = true;
    this.handle.removeEventListener("pointermove", this.onMove);
    this.handle.removeEventListener("pointerup", this.onUp);
    this.handle.removeEventListener("pointercancel", this.onCancel);
    this.drag = null;
  }
}

export const BlockDragHandle = Extension.create({
  name: "blockDragHandle",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockDragHandle"),
        view: (view) => new DragHandleView(view),
      }),
    ];
  },
});
