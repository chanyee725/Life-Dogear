"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  densityRatio,
  groupTopicsByInitial,
  matchesTopic,
  sortTopics,
  topicSearchKey,
  type TopicSort,
} from "./topic-index";

export type IndexTopic = { name: string; count: number; href: string };

/**
 * Left-hand topic index on `/resources`: text filter (client-side), sort links
 * (`?sort=name` keeps the choice in the URL) and one row per topic with a density bar
 * sized against the largest topic. Sticky with its own scroll on lg; a collapsible
 * panel above the list on smaller screens.
 */
export function TopicIndex({
  topics,
  selected,
  sort,
  sortHrefs,
}: {
  topics: readonly IndexTopic[];
  selected: string | null;
  sort: TopicSort;
  sortHrefs: Record<TopicSort, string>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const keyed = useMemo(() => topics.map((t) => ({ ...t, key: topicSearchKey(t.name) })), [topics]);
  // Bars keep their scale while filtering: always against the largest topic overall.
  const max = useMemo(() => Math.max(0, ...topics.map((t) => t.count)), [topics]);
  const visible = useMemo(() => keyed.filter((t) => matchesTopic(t.key, query)), [keyed, query]);
  const groups = useMemo(
    () =>
      sort === "name"
        ? groupTopicsByInitial(visible)
        : [{ key: "", topics: sortTopics(visible, "count") }],
    [visible, sort],
  );

  // Keep the chosen topic in view inside the index's own scroll area (no page scroll).
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !row) return;
    const top = row.offsetTop;
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = Math.max(0, top - list.clientHeight / 3);
  }, [selected, sort, open]);

  return (
    <aside
      aria-label="주제 색인"
      className="flex min-w-0 flex-col rounded-lg border border-border lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]"
    >
      {/* Small screens: a summary row that opens the index. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] lg:hidden"
      >
        <span className="font-semibold text-muted">주제</span>
        <span className="text-xs text-muted tabular-nums">{topics.length}</span>
        <span className="min-w-0 flex-1 truncate text-fg">
          {selected ? `#${selected}` : <span className="text-muted">주제 고르기</span>}
        </span>
        <Chevron open={open} />
      </button>

      <div
        id={panelId}
        className={cn(
          "min-h-0 flex-col",
          open ? "flex border-t border-border lg:border-t-0" : "hidden",
          "lg:flex",
        )}
      >
        <div className="flex flex-col gap-2 border-b border-border px-3 pt-3 pb-2.5">
          <h2 className="hidden items-baseline gap-1.5 text-[13px] font-semibold text-muted lg:flex">
            주제
            <span className="text-xs font-normal tabular-nums">{topics.length}</span>
          </h2>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="주제 찾기"
            aria-label="주제 찾기"
          />
          <nav aria-label="주제 정렬" className="flex items-center gap-1.5 text-xs">
            <SortLink href={sortHrefs.count} active={sort === "count"}>
              많은 순
            </SortLink>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <SortLink href={sortHrefs.name} active={sort === "name"}>
              가나다 순
            </SortLink>
          </nav>
        </div>

        <div
          ref={listRef}
          className="relative max-h-[60vh] min-h-0 overflow-y-auto overscroll-contain px-1.5 pt-1 pb-2 lg:max-h-none"
        >
          {visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-muted">맞는 주제가 없습니다.</p>
          ) : (
            groups.map((group) => (
              <div
                key={group.key || "all"}
                role={group.key ? "group" : undefined}
                aria-label={group.key || undefined}
              >
                {group.key ? (
                  <p aria-hidden className="px-2 pt-2 pb-0.5 text-xs font-medium text-faint">
                    {group.key}
                  </p>
                ) : null}
                <ul className="flex flex-col">
                  {group.topics.map((t) => {
                    const active = t.name === selected;
                    const ratio = densityRatio(t.count, max);
                    return (
                      <li key={t.name}>
                        <Link
                          href={t.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "true" : undefined}
                          aria-label={`${t.name}, 자료 ${t.count}개${active ? " (선택됨, 누르면 해제)" : ""}`}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors",
                            active ? "bg-subtle font-medium text-fg" : "text-fg hover:bg-subtle",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          <span aria-hidden className="flex h-1.5 w-14 shrink-0">
                            <span
                              className={cn(
                                "h-full rounded-full",
                                active ? "bg-accent" : "bg-accent-soft",
                              )}
                              style={{ width: `${Math.max(ratio * 100, 6)}%` }}
                            />
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              "w-6 shrink-0 text-right text-xs tabular-nums",
                              active ? "text-fg" : "text-muted",
                            )}
                          >
                            {t.count}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded px-0.5 transition-colors",
        active ? "font-medium text-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0 text-muted", open && "rotate-180")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 6.25 8 9.75l3.5-3.5" />
    </svg>
  );
}
