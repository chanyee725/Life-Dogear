"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import type { GraphNode } from "@/lib/graph/types";
import type { GraphTheme } from "./graph-theme";
import { GRAPH_TYPE_LABEL, searchNodes } from "./model";
import { ShapeIcon } from "./ShapeIcon";

/**
 * Node search popover (`/`): top centre of the canvas, 400px. ↑↓ moves, Enter picks,
 * Esc closes (design 6.3).
 */
export function GraphSearch({
  nodes,
  theme,
  onPick,
  onClose,
}: {
  nodes: readonly GraphNode[];
  theme: GraphTheme;
  onPick: (node: GraphNode) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchNodes(nodes, query), [nodes, query]);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div
      className="absolute top-4 left-1/2 z-30 w-[min(400px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-bg shadow-overlay"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        aria-label="노드 검색"
        placeholder="노드 검색…"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const node = results[active];
            if (node) onPick(node);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        className="h-10 w-full bg-transparent px-3 text-sm text-fg placeholder:text-muted focus:outline-none"
      />
      {query.trim() ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="검색 결과"
          className="border-t border-border py-1"
        >
          {results.length === 0 ? (
            <li className="flex h-9 items-center px-3 text-[13px] text-muted">
              일치하는 항목이 없습니다
            </li>
          ) : (
            results.map((node, i) => (
              <li
                key={node.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(node)}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 px-3 text-sm text-fg",
                  i === active && "bg-hover",
                )}
              >
                <ShapeIcon
                  type={node.type}
                  horizon={node.horizon}
                  theme={theme}
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1 truncate">{node.title}</span>
                <span className="shrink-0 text-xs text-muted">{GRAPH_TYPE_LABEL[node.type]}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
