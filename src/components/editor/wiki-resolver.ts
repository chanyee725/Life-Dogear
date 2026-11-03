"use client";

import { useEffect, useSyncExternalStore } from "react";
import { resolveWikiTitles } from "@/app/_actions/wikilinks";
import { safeAction } from "@/components/links/safe-action";
import { ITEM_ROUTE, ITEM_TYPE } from "@/lib/enums";
import { isValidItemId } from "@/lib/ids";
import type { ItemRef } from "@/lib/repo/shared";
import type { ItemSummary } from "@/lib/repo/items";
import { titleKey } from "@/lib/wikilinks";

/**
 * Client cache for `[[title]]` → item. Wiki-link node views ask for their title; asks
 * made in the same tick go to the server in one request. `undefined` = loading,
 * `null` = no such item (shown gray).
 */
type Entry = ItemSummary | null | undefined;

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

const notify = () => listeners.forEach((l) => l());

async function flush() {
  timer = null;
  const titles = [...pending];
  pending = new Set();
  const result = await safeAction(() => resolveWikiTitles(titles));
  for (const t of titles) {
    // Leave failed lookups "loading" so the next ask retries instead of showing gray.
    if (result.ok) cache.set(titleKey(t), result.data[titleKey(t)] ?? null);
    else cache.delete(titleKey(t));
  }
  notify();
}

function request(title: string) {
  const key = titleKey(title);
  if (cache.has(key) || !key) return;
  cache.set(key, undefined);
  pending.add(title);
  timer ??= setTimeout(flush, 0);
}

/** Forget everything (after creating an item or renaming): links re-resolve. */
export function invalidateWikiTitles(): void {
  const titles = [...cache.keys()];
  cache.clear();
  for (const t of titles) request(t);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWikiTarget(title: string): Entry {
  useEffect(() => request(title), [title]);
  return useSyncExternalStore(
    subscribe,
    () => cache.get(titleKey(title)),
    () => undefined,
  );
}

/** Detail page path of an item. */
export const itemHref = (ref: ItemRef) => `${ITEM_ROUTE[ref.type]}/${encodeURIComponent(ref.id)}`;

/** The item whose detail page `pathname` is (`/papers/<id>`), else null (lists, new pages). */
export function itemFromPath(pathname: string | null): ItemRef | null {
  const m = /^(\/[a-z]+)\/([^/?#]+)\/?$/.exec(pathname ?? "");
  if (!m) return null;
  const type = ITEM_TYPE.values.find((t) => ITEM_ROUTE[t] === m[1]);
  const id = decodeURIComponent(m[2]);
  return type && isValidItemId(id) ? { type, id } : null;
}
