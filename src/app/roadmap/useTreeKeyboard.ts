"use client";

import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";

/**
 * Keyboard navigation for the roadmap tree (WAI-ARIA tree pattern, roving tabindex).
 *
 * DOM contract (design-302):
 *   ul.rt-tree[role=tree] > li.rt-node[role=treeitem][data-id][aria-expanded?]
 *     > div.rt-row + ul.rt-group[role=group] > li.rt-node ...
 *
 * Attach the returned onKeyDown to ul.rt-tree. Collapsed state is owned by the
 * caller (useTreeCollapse in collapse.ts); this hook only reads `collapsed.has`.
 */
export interface UseTreeKeyboardOptions {
  rootRef: RefObject<HTMLElement | null>;
  /** Anything with has(id) — e.g. CollapsedSet from collapse.ts. */
  collapsed: { has(id: string): boolean };
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

export interface UseTreeKeyboardResult {
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

const ITEM = '[role="treeitem"]';

function isVisible(item: HTMLElement, root: HTMLElement): boolean {
  let el = item.parentElement;
  while (el && el !== root) {
    if (el.getAttribute("role") === "treeitem" && el.getAttribute("aria-expanded") === "false") {
      return false;
    }
    el = el.parentElement;
  }
  return true;
}

function visibleItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ITEM)).filter((it) => isVisible(it, root));
}

function parentItem(item: HTMLElement, root: HTMLElement): HTMLElement | null {
  const p = item.parentElement?.closest<HTMLElement>(ITEM) ?? null;
  return p && root.contains(p) ? p : null;
}

function firstChild(item: HTMLElement): HTMLElement | null {
  return item.querySelector<HTMLElement>(`:scope > [role="group"] > ${ITEM}`);
}

function hasChildren(item: HTMLElement): boolean {
  return item.hasAttribute("aria-expanded");
}

/** Move roving tabindex + focus to `next`. */
export function focusTreeItem(root: HTMLElement, next: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(`${ITEM}[tabindex="0"]`).forEach((el) => {
    if (el !== next) el.tabIndex = -1;
  });
  next.tabIndex = 0;
  next.focus();
}

/** data-ids of `item` and its ancestor treeitems, nearest first. */
function ancestry(item: HTMLElement, root: HTMLElement): string[] {
  const ids: string[] = [];
  for (let el: HTMLElement | null = item; el; el = parentItem(el, root)) {
    if (el.dataset.id) ids.push(el.dataset.id);
  }
  return ids;
}

export function useTreeKeyboard({
  rootRef,
  collapsed,
  onToggle,
  onSelect,
}: UseTreeKeyboardOptions): UseTreeKeyboardResult {
  // Path of the tabbable (tabindex=0) item, so a fold that unmounts it can hand the tab stop
  // to the nearest still-visible ancestor (or the first row).
  const tabPath = useRef<string[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const current = root.querySelector<HTMLElement>(`${ITEM}[tabindex="0"]`);
    if (current && isVisible(current, root)) {
      tabPath.current = ancestry(current, root);
      return;
    }
    const byId = (id: string) =>
      root.querySelector<HTMLElement>(`${ITEM}[data-id="${CSS.escape(id)}"]`);
    const next =
      tabPath.current.map(byId).find((el) => el && isVisible(el, root)) ??
      visibleItems(root)[0];
    if (!next) return;
    const lostFocus = document.activeElement === document.body;
    root.querySelectorAll<HTMLElement>(`${ITEM}[tabindex="0"]`).forEach((el) => {
      el.tabIndex = -1;
    });
    next.tabIndex = 0;
    if (lostFocus) next.focus();
    tabPath.current = ancestry(next, root);
  }, [rootRef, collapsed]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const root = rootRef.current;
      if (!root) return;
      const current = (e.target as HTMLElement).closest<HTMLElement>(ITEM);
      if (!current || !root.contains(current)) return;
      const id = current.dataset.id;
      if (!id) return;

      const go = (el: HTMLElement | null | undefined) => {
        if (!el) return;
        focusTreeItem(root, el);
        tabPath.current = ancestry(el, root);
      };

      switch (e.key) {
        case "ArrowDown":
        case "ArrowUp": {
          const items = visibleItems(root);
          const i = items.indexOf(current);
          go(items[e.key === "ArrowDown" ? i + 1 : i - 1]);
          break;
        }
        case "Home":
          go(visibleItems(root)[0]);
          break;
        case "End": {
          const items = visibleItems(root);
          go(items[items.length - 1]);
          break;
        }
        case "ArrowRight":
          if (!hasChildren(current)) return;
          if (collapsed.has(id)) onToggle(id);
          else go(firstChild(current));
          break;
        case "ArrowLeft":
          if (hasChildren(current) && !collapsed.has(id)) onToggle(id);
          else go(parentItem(current, root));
          break;
        case "Enter":
          // Let native buttons (twisty) handle their own Enter.
          if ((e.target as HTMLElement).classList.contains("rt-twisty")) return;
          onSelect(id);
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [rootRef, collapsed, onToggle, onSelect],
  );

  return { onKeyDown };
}
