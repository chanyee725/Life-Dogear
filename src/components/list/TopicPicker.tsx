"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { filterChipClass } from "./TagFilter";

export type TopicOption = { name: string; count: number; href: string };

/**
 * One "주제" button instead of a wall of tag chips: opens a small panel with a search box and
 * the topics by count. Links carry the other query params (built on the server). The chosen
 * topic shows on the button, with a separate clear link.
 */
export function TopicPicker({
  topics,
  selected,
  clearHref,
}: {
  topics: readonly TopicOption[];
  selected?: string;
  clearHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.normalize("NFC").trim().toLowerCase();
    const list = q ? topics.filter((t) => t.name.toLowerCase().includes(q)) : topics;
    return [...list].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
  }, [topics, query]);

  if (topics.length === 0) return null;
  const current = selected
    ? (topics.find((t) => t.name.toLowerCase() === selected.toLowerCase())?.name ?? selected)
    : undefined;

  return (
    <div ref={rootRef} className="relative flex items-center gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(filterChipClass(Boolean(current)), "border-border")}
      >
        {current ? `#${current}` : "주제"}
        <span aria-hidden className="text-[10px] text-muted">
          ▾
        </span>
      </button>
      {current ? (
        <Link
          href={clearHref}
          aria-label="주제 필터 지우기"
          className="flex h-7 w-6 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
        >
          ×
        </Link>
      ) : null}
      {open ? (
        <div
          id={panelId}
          className="absolute top-full left-0 z-20 mt-1 flex w-64 flex-col rounded-lg border border-border bg-bg shadow-overlay"
        >
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`주제 ${topics.length}개 중 찾기`}
              aria-label="주제 찾기"
              className="h-8 w-full rounded-md border border-border bg-bg px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-muted">맞는 주제가 없습니다.</li>
            ) : (
              shown.map((t) => {
                const active = t.name === current;
                return (
                  <li key={t.name}>
                    <Link
                      href={active ? clearHref : t.href}
                      aria-current={active ? "true" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-subtle",
                        active ? "font-medium text-accent" : "text-fg",
                      )}
                    >
                      <span className="truncate">#{t.name}</span>
                      <span className="text-xs text-muted tabular-nums">{t.count}</span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
