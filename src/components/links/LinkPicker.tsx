"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { linkItems } from "@/app/_actions/links";
import { searchItemTitles } from "@/app/_actions/items";
import { Badge, Button, Dialog, Input, Spinner } from "@/components/ui";
import { ITEM_TYPE } from "@/lib/enums";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import type { ItemSummary } from "@/lib/repo/items";
import type { ItemRef } from "@/lib/repo/shared";
import { safeAction } from "./safe-action";

const keyOf = (ref: ItemRef) => `${ref.type}:${ref.id}`;

/**
 * "연결 추가" button + dialog: search titles across all types and link the chosen
 * item to `item`. The item itself is excluded; already connected items are shown
 * but disabled. `connectedKeys` are `type:id` strings.
 */
export function LinkPicker({
  item,
  connectedKeys = [],
  label = "연결 추가",
}: {
  item: ItemRef;
  connectedKeys?: string[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, startLinking] = useTransition();
  const latest = useRef(0);
  const connected = new Set(connectedKeys);

  async function search(q: string) {
    const ticket = ++latest.current;
    setSearching(true);
    const res = await safeAction(
      () => searchItemTitles(q, item),
      "검색하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    if (ticket !== latest.current) return; // a newer search is in flight
    setSearching(false);
    if (res.ok) {
      setResults(res.data);
      setError(null);
    } else {
      setResults([]);
      setError(res.error);
    }
  }
  const debouncedSearch = useDebouncedCallback((q: string) => void search(q), 200);

  // Show recent items as soon as the dialog opens.
  useEffect(() => {
    if (!open) return;
    void search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per open
  }, [open]);

  function close() {
    debouncedSearch.cancel();
    latest.current++;
    setOpen(false);
    setQuery("");
    setResults(null);
    setSearching(false);
    setError(null);
  }

  function choose(target: ItemRef) {
    startLinking(async () => {
      const res = await safeAction(() => linkItems(item, target));
      if (res.ok) {
        close();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <span aria-hidden>+</span>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="항목 연결"
        description="제목으로 논문·세미나·생각·연구를 찾아 연결합니다."
      >
        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            type="search"
            value={query}
            placeholder="제목 검색"
            aria-label="연결할 항목 제목 검색"
            maxLength={200}
            onChange={(e) => {
              setQuery(e.target.value);
              debouncedSearch(e.target.value);
            }}
          />
          {error ? (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}
          <div className="max-h-72 min-h-24 overflow-y-auto" aria-busy={searching || linking}>
            {results === null ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">
                {query.trim() ? "검색 결과가 없습니다." : "연결할 수 있는 항목이 없습니다."}
              </p>
            ) : (
              <ul className="flex flex-col">
                {results.map((r) => {
                  const already = connected.has(keyOf(r.ref));
                  return (
                    <li key={keyOf(r.ref)}>
                      <button
                        type="button"
                        disabled={already || linking}
                        onClick={() => choose(r.ref)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <Badge tone={ITEM_TYPE.tone(r.type)}>{ITEM_TYPE.label(r.type)}</Badge>
                        <span className="min-w-0 flex-1 truncate">{r.title}</span>
                        {already ? <span className="text-xs text-muted">연결됨</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
