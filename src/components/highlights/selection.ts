import {
  MAX_HIGHLIGHT_TEXT,
  normalizeHighlightText,
  toPageRatios,
  type RatioRect,
} from "@/lib/highlights";
import { PAGE_ATTR } from "./viewer-hooks";

export type PendingHighlight = {
  page: number;
  text: string;
  rects: RatioRect[];
  /** Viewport point under the end of the selection, for placing the menu. */
  anchor: { x: number; y: number };
};

function pageElementOf(node: Node | null, root: HTMLElement): HTMLElement | null {
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  const page = el?.closest<HTMLElement>(`[${PAGE_ATTR}]`) ?? null;
  return page && root.contains(page) ? page : null;
}

/**
 * Copy of `range` ending inside `pageEl`: a selection dragged onto later pages is
 * cut at the end of the page where it starts, so text and rects match.
 */
function clipToPage(range: Range, pageEl: HTMLElement): Range {
  const clipped = range.cloneRange();
  if (!pageEl.contains(range.endContainer)) clipped.setEnd(pageEl, pageEl.childNodes.length);
  return clipped;
}

/**
 * Client rects of the text inside `range`, one text node at a time. Rects of
 * elements (the text layer's full-page `endOfContent` filler, page boxes) are
 * never included, so a drag past the last line cannot make a page-sized rect.
 */
export function textRects(range: Range): DOMRect[] {
  const root = range.commonAncestorContainer;
  const doc = root.ownerDocument ?? document;
  const out: DOMRect[] = [];
  const add = (node: Text) => {
    if (!node.data.trim() || !range.intersectsNode(node)) return;
    const part = doc.createRange();
    part.selectNodeContents(node);
    if (node === range.startContainer) part.setStart(node, range.startOffset);
    if (node === range.endContainer) part.setEnd(node, range.endOffset);
    out.push(...Array.from(part.getClientRects()));
  };
  if (root.nodeType === Node.TEXT_NODE) {
    add(root as Text);
    return out;
  }
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) add(n as Text);
  return out;
}

/**
 * Reads the current text selection inside `root` (the viewer). A selection that
 * spans pages is cut to the page where it starts (text and rects alike). Returns
 * null when there is no usable selection on a page.
 */
export function readSelection(root: HTMLElement): PendingHighlight | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const original = selection.getRangeAt(0);
  const pageEl = pageElementOf(original.startContainer, root);
  if (!pageEl) return null;
  const page = Number(pageEl.getAttribute(PAGE_ATTR));
  if (!Number.isInteger(page) || page < 1) return null;

  const range = clipToPage(original, pageEl);
  const text = normalizeHighlightText(range.toString());
  if (!text || text.length > MAX_HIGHLIGHT_TEXT) return null;

  const box = pageEl.getBoundingClientRect();
  const clientRects = textRects(range);
  const rects = toPageRatios(clientRects, box);
  if (!rects.length) return null;

  const end = clientRects[clientRects.length - 1] ?? box;
  return {
    page,
    text,
    rects,
    anchor: { x: Math.min(end.right, box.right), y: Math.min(end.bottom, box.bottom) },
  };
}
