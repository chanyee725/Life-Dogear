"use client";

import { useRouter } from "next/navigation";
import { OPEN_CAPTURE_EVENT } from "@/components/capture/capture";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Kbd, Spinner, cn } from "@/components/ui";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { MAX_QUERY_LENGTH } from "@/lib/search/text";
import type { SearchHit } from "@/lib/search/types";
import {
  fieldHint,
  groupHits,
  hitKey,
  isPaletteShortcut,
  matchCommands,
  moveActive,
  OPEN_PALETTE_EVENT,
  SEARCH_DEBOUNCE_MS,
  type PaletteCommand,
  typeLabel,
  typeTone,
} from "./palette";

type Status = "idle" | "loading" | "done" | "error";

/**
 * Global search (mounted once in the root layout). Cmd/Ctrl+K toggles it, Esc closes,
 * ↑/↓ move, Enter opens the active result. Searches titles, bodies and highlights.
 */
export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Enter pressed before results for the current query arrived: open the top hit then. */
  const enterPending = useRef(false);
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(-1);

  const { groups, flat } = groupHits(hits);
  // Commands come first in the ↑/↓ order; hits follow (index offset by `commands.length`).
  const commands = matchCommands(query);
  const total = commands.length + flat.length;

  async function runSearch(q: string) {
    abortRef.current?.abort();
    if (!q.trim()) {
      enterPending.current = false;
      setHits([]);
      setStatus("idle");
      setActive(-1);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      const data = (await res.json()) as { hits: SearchHit[] };
      if (enterPending.current) {
        enterPending.current = false;
        const top = groupHits(data.hits).flat[0];
        if (top) return go(top);
      }
      setHits(data.hits);
      setActive(data.hits.length || matchCommands(q).length ? 0 : -1);
      setStatus("done");
    } catch (error) {
      if (controller.signal.aborted) return; // superseded by a newer query
      void error;
      enterPending.current = false;
      setHits([]);
      setActive(-1);
      setStatus("error");
    }
  }
  const debouncedSearch = useDebouncedCallback(
    (q: string) => void runSearch(q),
    SEARCH_DEBOUNCE_MS,
  );

  function close() {
    enterPending.current = false;
    debouncedSearch.cancel();
    abortRef.current?.abort();
    setOpen(false);
  }

  // Global shortcut and the open event.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || !isPaletteShortcut(event)) return;
      event.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Sync the native dialog; keep the last query but select it for quick replacement.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      inputRef.current?.select();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // Keep the active option visible.
  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    close();
    router.push(hit.href);
  }

  function run(command: PaletteCommand) {
    close();
    // After the palette dialog has closed (capture will not open over another dialog).
    if (command.id === "capture") {
      requestAnimationFrame(() => window.dispatchEvent(new Event(OPEN_CAPTURE_EVENT)));
    }
  }

  function choose(index: number) {
    if (index < 0) return;
    if (index < commands.length) run(commands[index]!);
    else go(flat[index - commands.length]);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter while the IME is composing commits the syllable; do not navigate.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => moveActive(i, event.key === "ArrowDown" ? 1 : -1, total));
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Commands rank first: one chosen with ↑/↓, or the top row for a typed query
      // (even before hits arrive), runs at once.
      if (commands.length && active < commands.length && (active >= 0 || query.trim())) {
        return choose(Math.max(active, 0));
      }
      // Results may lag behind fast typing: search now and open the top hit when it lands.
      if (debouncedSearch.pending() || status === "loading") {
        enterPending.current = true;
        debouncedSearch.flush();
        return;
      }
      choose(active);
    }
  }

  const trimmed = query.trim();
  const activeId = active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-label="전체 검색"
      onClose={() => {
        if (open) close();
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="mx-auto mt-[12vh] mb-auto w-[min(40rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg p-0 text-fg shadow-overlay backdrop:bg-black/30"
    >
      {open ? (
        <div className="flex max-h-[70vh] flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <span aria-hidden className="text-faint">
              ⌕
            </span>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              role="combobox"
              aria-expanded={total > 0}
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-label="검색어"
              placeholder="제목, 본문, 하이라이트 검색"
              maxLength={MAX_QUERY_LENGTH}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                debouncedSearch(e.target.value);
              }}
              onKeyDown={onInputKeyDown}
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg placeholder:text-faint focus:outline-none"
            />
            {status === "loading" ? <Spinner /> : null}
            <Kbd>Esc</Kbd>
          </div>

          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="검색 결과"
            aria-busy={status === "loading"}
            className="min-h-0 flex-1 overflow-y-auto p-2"
          >
            {commands.length ? (
              <div role="group" aria-label="명령" className="mb-1">
                <div className="px-2 pt-2 pb-1 text-xs font-medium text-faint">명령</div>
                {commands.map((command, index) => (
                  <div
                    key={command.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => run(command)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2",
                      index === active ? "bg-hover" : "hover:bg-hover",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{command.label}</span>
                    <Kbd>{command.shortcut}</Kbd>
                  </div>
                ))}
              </div>
            ) : null}
            {!trimmed ? (
              <p className="px-2 py-6 text-center text-[13px] text-muted">
                프로젝트·영역·논문·노트·세미나·생각·목표·회고의 제목과 본문, 하이라이트를
                검색합니다.
              </p>
            ) : status === "error" ? (
              <p role="alert" className="px-2 py-6 text-center text-[13px] text-danger">
                검색하지 못했습니다. 잠시 후 다시 시도해 주세요.
              </p>
            ) : flat.length === 0 ? (
              commands.length && status !== "done" ? null : (
                <p className="px-2 py-6 text-center text-[13px] text-muted">
                  {status === "done" ? "검색 결과가 없습니다." : "검색 중…"}
                </p>
              )
            ) : (
              groups.map((group) => (
                <div key={group.type} role="group" aria-label={group.label} className="mb-1">
                  <div className="px-2 pt-2 pb-1 text-xs font-medium text-faint">{group.label}</div>
                  {group.hits.map((hit) => {
                    const index = commands.length + flat.indexOf(hit);
                    return (
                      <HitRow
                        key={hitKey(hit)}
                        id={`${listId}-${index}`}
                        index={index}
                        hit={hit}
                        active={index === active}
                        onHover={() => setActive(index)}
                        onChoose={() => choose(index)}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-faint">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> 이동
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd> 열기
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd> 닫기
            </span>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

function HitRow({
  id,
  index,
  hit,
  active,
  onHover,
  onChoose,
}: {
  id: string;
  index: number;
  hit: SearchHit;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const hint = fieldHint(hit);
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2",
        active ? "bg-hover" : "hover:bg-hover",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Badge tone={typeTone(hit.type)} className="shrink-0">
          {typeLabel(hit.type)}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm">{hit.title}</span>
        {hit.archived ? (
          <Badge tone="gray" className="shrink-0">
            보관됨
          </Badge>
        ) : null}
        {hint ? <span className="shrink-0 text-xs text-faint">{hint}</span> : null}
      </div>
      {hit.snippet ? (
        <p className="line-clamp-2 pl-0.5 text-[13px] break-words text-muted">
          {hit.snippet.before}
          <mark className="rounded-sm bg-accent-soft px-0.5 text-fg">{hit.snippet.match}</mark>
          {hit.snippet.after}
        </p>
      ) : null}
    </div>
  );
}
