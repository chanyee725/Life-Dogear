import "server-only";
/**
 * Google Calendar, write: adds one event through the Calendar API with a long-lived OAuth
 * refresh token (`GOOGLE_OAUTH_*`, separate from the sign-in `AUTH_GOOGLE_*`). Plain `fetch`.
 * Secrets stay in this module: errors carry only a short code, never a token or a body.
 */
import { addDays, CALENDAR_TZ, parseDay } from "./dates";
import { msToZonedIso, wallToMs } from "./ics/zone";
import type { CalendarItem } from "./types";

export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const EVENTS_URL = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
export const WRITE_TIMEOUT_MS = 8000;
export const TITLE_MAX = 200;
/** Refresh this long before Google's stated expiry. */
const EXPIRY_MARGIN_MS = 60_000;

type Env = Record<string, string | undefined>;
export type GoogleWriteOptions = { env?: Env; fetchImpl?: typeof fetch; now?: () => number };

export type GoogleWriteErrorCode = "not_configured" | "auth" | "network" | "invalid";

export class GoogleWriteError extends Error {
  override name = "GoogleWriteError";
  constructor(readonly code: GoogleWriteErrorCode) {
    super(code);
  }
}

/**
 * `date` is `YYYY-MM-DD`; `start`/`end` are `HH:mm` in `CALENDAR_TZ`. No `start` = all day.
 * `clientId`: Google event id the client keeps across retries, so a retry after a lost
 * response does not create a second event.
 */
export type NewEvent = {
  title: string;
  date: string;
  start?: string;
  end?: string;
  clientId?: string;
};

/** Google event ids: base32hex lowercase, 5–1024 chars. */
export const EVENT_ID_RE = /^[a-v0-9]{5,1024}$/;

/** Fresh event id (hex is a subset of base32hex). */
export const newEventId = (): string => crypto.randomUUID().replace(/-/g, "");

type Config = { clientId: string; clientSecret: string; refreshToken: string; calendarId: string };

function readConfig(env: Env = process.env): Config | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim() || "primary";
  return { clientId, clientSecret, refreshToken, calendarId };
}

/** Whether the three OAuth keys are set (the calendar id defaults to `primary`). */
export const googleWriteEnabled = (env: Env = process.env): boolean => readConfig(env) !== null;

// ---- input ---------------------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Valid event input, or null. `end` needs `start` and must come after it (same day). */
export function parseNewEvent(value: unknown): NewEvent | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.replace(/\s+/g, " ").trim() : "";
  if (!title || title.length > TITLE_MAX) return null;
  if (typeof v.date !== "string" || !parseDay(v.date)) return null;
  const blank = (x: unknown) => x === undefined || x === null || x === "";
  const start = blank(v.start) ? undefined : v.start;
  const end = blank(v.end) ? undefined : v.end;
  if (start !== undefined && (typeof start !== "string" || !TIME_RE.test(start))) return null;
  if (end !== undefined && (typeof end !== "string" || !TIME_RE.test(end))) return null;
  if (end !== undefined && (start === undefined || end <= start)) return null;
  const clientId = blank(v.clientId) ? undefined : v.clientId;
  if (clientId !== undefined && (typeof clientId !== "string" || !EVENT_ID_RE.test(clientId))) {
    return null;
  }
  return {
    title,
    date: v.date,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(clientId ? { clientId } : {}),
  };
}

// ---- access token ----------------------------------------------------------------------

type Token = { key: string; value: string; expires: number };
// On globalThis so dev reloads keep it. Keyed by client id so a changed env refetches.
const store = globalThis as unknown as { __researchBrainGoogleToken?: Token };

/** Test hook. */
export function clearGoogleTokenCache(): void {
  delete store.__researchBrainGoogleToken;
}

async function send(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    throw new GoogleWriteError("network");
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(config: Config, fetchImpl: typeof fetch, now: () => number) {
  const key = config.clientId;
  const hit = store.__researchBrainGoogleToken;
  if (hit && hit.key === key && hit.expires > now()) return hit.value;

  const res = await send(fetchImpl, TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  // 400 invalid_grant (revoked/expired refresh token) and 401 invalid_client are both auth.
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new GoogleWriteError("auth");
  }
  if (!res.ok) throw new GoogleWriteError("network");
  const body = (await res.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (typeof body?.access_token !== "string" || !body.access_token) {
    throw new GoogleWriteError("auth");
  }
  const seconds = typeof body.expires_in === "number" ? body.expires_in : 3600;
  store.__researchBrainGoogleToken = {
    key,
    value: body.access_token,
    expires: now() + seconds * 1000 - EXPIRY_MARGIN_MS,
  };
  return body.access_token;
}

// ---- event -----------------------------------------------------------------------------

const HOUR_MS = 3_600_000;

function wallMs(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return wallToMs({ year, month, day, hour, minute, second: 0 }, CALENDAR_TZ);
}

/** Calendar API request body (`id` makes the insert idempotent). */
export function eventBody(event: NewEvent, id?: string): Record<string, unknown> {
  const head = { ...(id ? { id } : {}), summary: event.title };
  if (!event.start) {
    return {
      ...head,
      start: { date: event.date },
      // Google's all-day end is exclusive.
      end: { date: addDays(event.date, 1) },
    };
  }
  const startMs = wallMs(event.date, event.start);
  const endMs = event.end ? wallMs(event.date, event.end) : startMs + HOUR_MS;
  return {
    ...head,
    start: { dateTime: msToZonedIso(startMs, CALENDAR_TZ), timeZone: CALENDAR_TZ },
    end: { dateTime: msToZonedIso(endMs, CALENDAR_TZ), timeZone: CALENDAR_TZ },
  };
}

type ApiTime = { date?: string; dateTime?: string };
type ApiEvent = {
  id?: string;
  status?: string;
  iCalUID?: string;
  htmlLink?: string;
  summary?: string;
  start?: ApiTime;
  end?: ApiTime;
};

const zoned = (iso: string | undefined): string | null => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? null : msToZonedIso(ms, CALENDAR_TZ);
};

/**
 * The created event as a `CalendarItem`, shaped like the ICS reader's (same id rule, so
 * the client can drop the duplicate once the feed catches up). Falls back to what was sent.
 */
export function toCalendarItem(created: ApiEvent, sent: NewEvent): CalendarItem {
  const sentBody = eventBody(sent) as { start: ApiTime; end: ApiTime };
  const startT = created.start?.date || created.start?.dateTime ? created.start! : sentBody.start;
  const endT = created.end?.date || created.end?.dateTime ? created.end! : sentBody.end;
  const uid = created.iCalUID || (created.id ? `${created.id}@google.com` : `new-${Date.now()}`);
  const title = created.summary?.trim() || sent.title;
  const href = created.htmlLink?.startsWith("https://") ? created.htmlLink : undefined;

  if (startT.date) {
    const start = startT.date;
    const last = endT.date && endT.date > start ? addDays(endT.date, -1) : start;
    return {
      id: `google:${uid}:${start}`,
      source: "google",
      title,
      start,
      ...(last !== start ? { end: last } : {}),
      allDay: true,
      ...(href ? { href } : {}),
    };
  }
  const start = zoned(startT.dateTime) ?? (sentBody.start.dateTime as string);
  const end = zoned(endT.dateTime);
  return {
    id: `google:${uid}:${start}`,
    source: "google",
    title,
    start,
    ...(end && end !== start ? { end } : {}),
    allDay: false,
    ...(href ? { href } : {}),
  };
}

/**
 * Adds `input` to the configured calendar. Throws `GoogleWriteError` with
 * `not_configured | auth | network | invalid`.
 */
export async function insertEvent(
  input: NewEvent,
  options: GoogleWriteOptions = {},
): Promise<CalendarItem> {
  const { fetchImpl = fetch, now = Date.now } = options;
  const config = readConfig(options.env);
  if (!config) throw new GoogleWriteError("not_configured");
  const event = parseNewEvent(input);
  if (!event) throw new GoogleWriteError("invalid");

  const eventId = event.clientId ?? newEventId();
  const eventsUrl = EVENTS_URL(config.calendarId);

  const once = async (method: "POST" | "GET", url: string, body?: string) =>
    send(fetchImpl, url, {
      method,
      headers: {
        authorization: `Bearer ${await accessToken(config, fetchImpl, now)}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
    });
  const call = async (method: "POST" | "GET", url: string, body?: string) => {
    const res = await once(method, url, body);
    if (res.status !== 401) return res;
    // The cached access token may have been revoked early: one retry with a fresh one.
    clearGoogleTokenCache();
    return once(method, url, body);
  };

  let res = await call("POST", eventsUrl, JSON.stringify(eventBody(event, eventId)));
  if (res.status === 409) {
    // The id exists: an earlier attempt went through. Return that event.
    res = await call("GET", `${eventsUrl}/${encodeURIComponent(eventId)}`);
    if (res.ok) {
      const existing = (await res.json().catch(() => ({}))) as ApiEvent;
      // A deleted event keeps its id; the client must start over with a new one.
      if (existing.status === "cancelled") throw new GoogleWriteError("invalid");
      return toCalendarItem(existing, event);
    }
  }
  if (res.status === 401 || res.status === 403) throw new GoogleWriteError("auth");
  // Unknown calendar id: a setup problem, not the user's input.
  if (res.status === 404) throw new GoogleWriteError("not_configured");
  if (res.status === 400 || res.status === 409) throw new GoogleWriteError("invalid");
  if (!res.ok) throw new GoogleWriteError("network");
  const created = (await res.json().catch(() => ({}))) as ApiEvent;
  return toCalendarItem(created, event);
}
