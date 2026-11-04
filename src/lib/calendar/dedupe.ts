/**
 * Merging just-added Google items into a fetched list. Pure, client-safe.
 *
 * Ids are `google:<uid>:<start>`, but the ICS reader writes `start` in the feed's zone while
 * the writer uses Asia/Seoul, so the same event can carry two ids. Google items therefore
 * match on uid + start instant (all-day: uid + day); everything else on id.
 */
import type { CalendarItem } from "./types";

export function sameEventKey(item: CalendarItem): string {
  const prefix = "google:";
  const suffix = `:${item.start}`;
  if (item.source !== "google" || !item.id.startsWith(prefix) || !item.id.endsWith(suffix)) {
    return `id|${item.id}`;
  }
  const uid = item.id.slice(prefix.length, item.id.length - suffix.length);
  if (item.allDay) return `google|${uid}|${item.start}`;
  const ms = Date.parse(item.start);
  return Number.isNaN(ms) ? `id|${item.id}` : `google|${uid}|${ms}`;
}

/**
 * `items` plus the `added` ones not already there (optimistic: the feed lags up to 10 min).
 * The fetched copy wins once the feed catches up. Returns `items` itself when nothing is new.
 */
export function mergeAdded(items: CalendarItem[], added: CalendarItem[]): CalendarItem[] {
  if (added.length === 0) return items;
  const keys = new Set(items.map(sameEventKey));
  const extra = added.filter((a) => {
    const key = sameEventKey(a);
    return !keys.has(key) && !!keys.add(key);
  });
  return extra.length ? [...items, ...extra] : items;
}

/**
 * The `added` items the fetched list does not have yet; once the feed carries one it no
 * longer needs keeping. Returns `added` itself when nothing dropped out.
 */
export function pendingAdded(items: CalendarItem[], added: CalendarItem[]): CalendarItem[] {
  if (added.length === 0) return added;
  const keys = new Set(items.map(sameEventKey));
  const left = added.filter((a) => !keys.has(sameEventKey(a)));
  return left.length === added.length ? added : left;
}
