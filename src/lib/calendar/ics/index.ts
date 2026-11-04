import "server-only";
/**
 * Google Calendar, read-only, from the private iCal addresses in `GOOGLE_CALENDAR_ICS_URLS`
 * (comma separated). The addresses are secrets: they never leave this module — not in
 * logs, errors, responses or items. A failing feed is named only by its position (#1, #2…).
 */
import { describeError } from "@/lib/storage/describe-error";
import type { CalendarItem, CalendarRange, GoogleStatus } from "../types";
import { feedUrl, fetchIcs } from "./fetch";
import { expandIcs, parseIcs, type ParsedFeed } from "./parse";

export const CACHE_OK_MS = 10 * 60_000;
export const CACHE_ERROR_MS = 60_000;
export const ENV_KEY = "GOOGLE_CALENDAR_ICS_URLS";
type Env = Record<string, string | undefined>;

type Entry = { expires: number; feed: Promise<ParsedFeed> };

// Per address, in memory; on globalThis so dev reloads keep it.
const store = globalThis as unknown as { __researchBrainIcsCache?: Map<string, Entry> };
const cache = () => (store.__researchBrainIcsCache ??= new Map());

/** Test hook. */
export function clearIcsCache(): void {
  cache().clear();
}

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

function loadFeed(raw: string, fetchImpl?: typeof fetch): Promise<ParsedFeed> {
  const now = Date.now();
  const hit = cache().get(raw);
  if (hit && hit.expires > now) return hit.feed;

  const feed = (async () => {
    const url = feedUrl(raw);
    if (!url) throw new IcsConfigError("bad_url");
    return parseIcs(await fetchIcs(url, { fetchImpl }));
  })();
  const entry: Entry = { expires: now + CACHE_OK_MS, feed };
  cache().set(raw, entry);
  // Failures are cached briefly too, so a broken feed is not refetched on every request.
  feed.catch(() => {
    if (cache().get(raw) === entry) entry.expires = Date.now() + CACHE_ERROR_MS;
  });
  return feed;
}

export async function loadGoogleItems(
  range: CalendarRange,
  options: { env?: Env; fetchImpl?: typeof fetch } = {},
): Promise<{ items: CalendarItem[]; status: GoogleStatus }> {
  const feeds = configuredFeeds(options.env);
  if (feeds.length === 0) return { items: [], status: "off" };

  let failed = false;
  const results = await Promise.all(
    feeds.map(async (raw, i) => {
      try {
        return expandIcs(await loadFeed(raw, options.fetchImpl), range);
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
  return { items, status: failed ? "error" : "ok" };
}
