// '일정 추가' (Google Calendar write) — client helpers. Pure, no secrets: the server holds them.
import type { CalendarItem } from "@/lib/calendar/types";

export const ADD_EVENT_URL = "/api/calendar/events";
export const EVENT_TITLE_MAX = 200;

export type AddEventInput = { title: string; date: string; start: string; end: string };

/** Short notice per `{ error }` code from `POST /api/calendar/events`. */
const ERROR_TEXT: Record<string, string> = {
  not_configured: "Google 캘린더 쓰기 설정이 필요합니다.",
  auth: "Google 연결이 만료됐습니다. 설정을 확인하세요.",
  network: "Google에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.",
  invalid: "입력을 확인하세요.",
};
export const ADD_FAILED = "일정을 추가하지 못했습니다.";
export const ADDED = "Google 캘린더에 추가했습니다.";

export const addEventError = (code: unknown): string =>
  (typeof code === "string" && ERROR_TEXT[code]) || ADD_FAILED;

/** Request body: blank times dropped (no start = all day; end needs start). */
export function eventPayload(input: AddEventInput) {
  const start = input.start.trim();
  const end = start ? input.end.trim() : "";
  return {
    title: input.title.trim(),
    date: input.date,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  };
}

/** Local check before sending; null when fine, else a short message. */
export function checkEvent(input: AddEventInput): string | null {
  if (!input.title.trim()) return "제목을 입력하세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "날짜를 고르세요.";
  const p = eventPayload(input);
  if (p.end && p.start && p.end <= p.start) return "끝 시간이 시작보다 늦어야 합니다.";
  return null;
}

export type AddEventResult = { ok: true; item: CalendarItem } | { ok: false; message: string };

/** Posts the event; never throws. */
export async function postEvent(
  input: AddEventInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AddEventResult> {
  let res: Response;
  try {
    res = await fetchImpl(ADD_EVENT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(eventPayload(input)),
    });
  } catch {
    return { ok: false, message: addEventError("network") };
  }
  const body = (await res.json().catch(() => null)) as { item?: CalendarItem; error?: unknown };
  if (res.ok && body?.item) return { ok: true, item: body.item };
  return { ok: false, message: addEventError(body?.error) };
}

/**
 * Items with the just-added ones merged in (optimistic: the Google feed lags up to 10 min).
 * Same id → the server's copy wins, so nothing shows twice once the feed catches up.
 */
export function mergeAdded(items: CalendarItem[], added: CalendarItem[]): CalendarItem[] {
  if (added.length === 0) return items;
  const ids = new Set(items.map((i) => i.id));
  const extra = added.filter((a) => !ids.has(a.id));
  return extra.length ? [...items, ...extra] : items;
}
