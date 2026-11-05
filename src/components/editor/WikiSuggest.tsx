"use client";

import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { useEffect, useRef, useState, type RefObject } from "react";
import { searchItemTitles } from "@/app/_actions/items";
import { safeAction } from "@/components/links/safe-action";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { ITEM_TYPE } from "@/lib/enums";
import type { ItemSummary } from "@/lib/repo/items";
import { cleanTitle, titleKey } from "@/lib/wikilinks";
import { inPlainTextZone, insertWikiLink } from "./WikiLink";
import { useCurrentDoc } from "./current-doc";

/** Typed `[[query` right before the cursor: `from` is the first `[`. */
export type WikiTrigger = { from: number; to: number; query: string };

const ATOM = "￼";
const MAX_QUERY = 100;

/** The open `[[…` before the cursor, if any (pure; exported for tests). */
export function findWikiTrigger(state: EditorState): WikiTrigger | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if (!$from.parent.isTextblock || inPlainTextZone($from)) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, ATOM);
  const start = before.lastIndexOf("[[");
  if (start === -1) return null;
  const query = before.slice(start + 2);
  if (query.length > MAX_QUERY || /[[\]\n]/.test(query) || query.includes(ATOM)) return null;
  return { from: $from.pos - (before.length - start), to: $from.pos, query };
}

type Option = { kind: "item"; item: ItemSummary } | { kind: "new"; title: string };

/** Key handler the editor calls first; returns true when the popup used the key. */
export type SuggestKeyHandler = (event: KeyboardEvent) => boolean;

const SEARCH_DELAY = 120;

/**
 * Title search popup for `[[`. ↑/↓ choose, Enter/Tab insert, Esc closes (until the
 * cursor leaves this `[[`). Results come from the link picker's title search; a title
 * nothing has can still be inserted (it shows gray until something gets that title).
 */
export function WikiSuggest({
  editor,
  keyHandler,
}: {
  editor: Editor;
  keyHandler: RefObject<SuggestKeyHandler | null>;
}) {
  const doc = useCurrentDoc();
  const [trigger, setTrigger] = useState<WikiTrigger | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  /** Search results and the query they answer (stale while a new search runs). */
  const [results, setResults] = useState<{ query: string; items: ItemSummary[] } | null>(null);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const update = () => setTrigger(editor.isEditable ? findWikiTrigger(editor.state) : null);
    const close = () => setTrigger(null);
    editor.on("transaction", update);
    editor.on("blur", close);
    return () => {
      editor.off("transaction", update);
      editor.off("blur", close);
    };
  }, [editor]);

  const open = trigger !== null && trigger.from !== dismissedAt;
  const query = trigger?.query ?? "";

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    const self = doc ?? undefined;
    const timer = setTimeout(async () => {
      const result = await safeAction(() => searchItemTitles(query.trim(), self));
      if (id !== requestId.current) return;
      setResults({ query, items: result.ok ? result.data.slice(0, 8) : [] });
      setActive(0);
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [open, query, doc]);

  // Until results for this exact query arrive, offer nothing: Enter must not insert the
  // raw text while a matching item is still loading.
  const loading = results?.query !== query;
  const found = loading ? [] : results!.items;
  const typed = cleanTitle(query);
  const options: Option[] = found.map((item) => ({ kind: "item" as const, item }));
  if (!loading && typed && !found.some((r) => titleKey(r.title) === titleKey(typed))) {
    options.push({ kind: "new", title: typed });
  }

  const choose = (option: Option | undefined) => {
    if (!trigger || !option) return;
    insertWikiLink(
      editor,
      trigger.from,
      trigger.to,
      option.kind === "item" ? option.item.title : option.title,
    );
    setResults(null);
  };

  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });

  useEffect(() => {
    keyHandler.current = (event) => {
      if (!open || !options.length) {
        if (open && event.key === "Escape") {
          setDismissedAt(trigger!.from);
          return true;
        }
        // Swallow Enter while the search for this query is still running.
        return open && loading && event.key === "Enter" && !event.isComposing;
      }
      switch (event.key) {
        case "ArrowDown":
          setActive((i) => (i + 1) % options.length);
          return true;
        case "ArrowUp":
          setActive((i) => (i - 1 + options.length) % options.length);
          return true;
        case "Enter":
        case "Tab":
          if (event.isComposing) return false;
          chooseRef.current(options[Math.min(active, options.length - 1)]);
          return true;
        case "Escape":
          setDismissedAt(trigger!.from);
          return true;
        default:
          return false;
      }
    };
    return () => {
      keyHandler.current = null;
    };
  });

  if (!open || (!options.length && !loading)) return null;
  const coords = editor.view.coordsAtPos(trigger.from);

  return (
    <div
      role="listbox"
      aria-label="연결할 항목"
      style={{ position: "fixed", top: coords.bottom + 4, left: coords.left }}
      className="z-30 flex w-72 flex-col gap-0.5 rounded-lg border border-border bg-bg p-1 text-sm shadow-overlay"
    >
      {loading && !options.length ? <span className="px-2 py-1.5 text-muted">찾는 중…</span> : null}
      {options.map((option, i) => (
        <button
          key={option.kind === "item" ? `${option.item.type}:${option.item.ref.id}` : "new"}
          type="button"
          role="option"
          aria-selected={i === active}
          // Keep focus (and the cursor) in the editor.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(i)}
          onClick={() => choose(option)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left",
            i === active ? "bg-hover" : "hover:bg-hover",
          )}
        >
          {option.kind === "item" ? (
            <>
              <Badge tone={ITEM_TYPE.tone(option.item.type)}>
                {ITEM_TYPE.label(option.item.type)}
              </Badge>
              <span className="min-w-0 truncate">{option.item.title}</span>
            </>
          ) : (
            <span className="min-w-0 truncate text-muted">
              <span className="text-faint">[[</span>
              {option.title}
              <span className="text-faint">]]</span> 새 제목으로 넣기
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
