import "server-only";
/**
 * Google Calendar, read-only, from the private iCal addresses in `GOOGLE_CALENDAR_ICS_URLS`
 * (comma separated). The addresses are secrets: they never leave this module — not in
 * logs, errors, responses or items. A failing feed is named only by its position (#1, #2…).
 */
import { createHash } from "node:crypto";
import { describeError } from "@/lib/storage/describe-error";
import type { CalendarItem, CalendarRange, GoogleStatus } from "../types";
import { feedUrl, fetchIcs } from "./fetch";
import { expandIcs, parseIcs, type Expansion, type ParsedFeed } from "./parse";

export const CACHE_OK_MS = 10 * 60_000;
export const CACHE_ERROR_MS = 60_000;
export const ENV_KEY = "GOOGLE_CALENDAR_ICS_URLS";
type Env = Record<string, string | undefined>;

/** Expanded ranges kept per feed (month and week views, a few steps back and forth). */
export const MAX_RANGES_PER_FEED = 12;

type Entry = {
  expires: number;
  feed: Promise<ParsedFeed>;
  /** `from..to` → expansion, oldest first; lives as long as the feed. */
  ranges: Map<string, Expansion>;
};

// Per address (keyed by its SHA-256, so the cache holds no address), in memory; on
// globalThis so dev reloads keep it.
const store = globalThis as unknown as { __researchBrainIcsCache?: Map<string, Entry> };
const cache = () => (store.__researchBrainIcsCache ??= new Map());

/** Test hooks. */
export function clearIcsCache(): void {
  cache().clear();
}
export const cachedRangeCount = (): number =>
  [...cache().values()].reduce((n, e) => n + e.ranges.size, 0);

/** Configured feed addresses (blank entries dropped). */
export function configuredFeeds(env: Env = process.env): string[] {
  return (env[ENV_KEY] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export class IcsConfigError extends Error {
  override name = "IcsConfigError";
  readonly code = "bad_url";
}

const keyOf = (raw: string) => createHash("sha256").update(raw).digest("hex");

function loadFeed(raw: string, fetchImpl?: typeof fetch): Entry {
  const now = Date.now();
  const key = keyOf(raw);
  const hit = cache().get(key);
  if (hit && hit.expires > now) return hit;

  const feed = (async () => {
    const url = feedUrl(raw);
    if (!url) throw new IcsConfigError("bad_url");
    return parseIcs(await fetchIcs(url, { fetchImpl }));
  })();
  const entry: Entry = { expires: now + CACHE_OK_MS, feed, ranges: new Map() };
  cache().set(key, entry);
  // Failures are cached briefly too, so a broken feed is not refetched on every request.
  feed.catch(() => {
    if (cache().get(key) === entry) entry.expires = Date.now() + CACHE_ERROR_MS;
  });
  return entry;
}

async function expandCached(entry: Entry, range: CalendarRange): Promise<Expansion> {
  const parsed = await entry.feed;
  const key = `${range.from}..${range.to}`;
  let result = entry.ranges.get(key);
  if (!result) {
    result = expandIcs(parsed, range);
    entry.ranges.set(key, result);
    if (entry.ranges.size > MAX_RANGES_PER_FEED) {
      entry.ranges.delete(entry.ranges.keys().next().value!);
    }
  }
  return result;
}

export async function loadGoogleItems(
  range: CalendarRange,
  options: { env?: Env; fetchImpl?: typeof fetch } = {},
): Promise<{ items: CalendarItem[]; status: GoogleStatus }> {
  const feeds = configuredFeeds(options.env);
  if (feeds.length === 0) return { items: [], status: "off" };

  let failed = false;
  let partial = false;
  const results = await Promise.all(
    feeds.map(async (raw, i) => {
      try {
        const { items, complete } = await expandCached(loadFeed(raw, options.fetchImpl), range);
        if (!complete) {
          partial = true;
          console.warn(`[calendar] Google calendar #${i + 1} truncated: expansion cap reached`);
        }
        return items;
      } catch (error) {
        failed = true;
        console.warn(`[calendar] Google calendar #${i + 1} failed:`, describeError(error));
        return [];
      }
    }),
  );
  // The same event can sit in two shared calendars.
  const seen = new Set<string>();
  const items = results.flat().filter((item) => !seen.has(item.id) && !!seen.add(item.id));
  return { items, status: failed ? "error" : partial ? "partial" : "ok" };
}
