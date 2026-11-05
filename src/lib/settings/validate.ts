import "server-only";
import { feedUrl } from "@/lib/calendar/ics/fetch";
import type { EditableKey } from "./types";

export const MAX_FEEDS = 10;
export const MAX_URL_LENGTH = 2000;
const CALENDAR_ID_RE = /^[A-Za-z0-9._@#+-]{1,254}$/;

export type ValidationResult = { ok: true; value: string } | { ok: false; message: string };

/**
 * Normalized value to store, or a user-facing message. The message never repeats the input
 * (it may be a secret). An empty value is valid: it clears the app setting.
 */
export function validateSetting(key: EditableKey, raw: unknown): ValidationResult {
  if (typeof raw !== "string") return { ok: false, message: "값이 올바르지 않습니다." };
  if (key === "GOOGLE_CALENDAR_ICS_URLS") {
    const urls = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length > MAX_FEEDS) {
      return { ok: false, message: `캘린더 주소는 ${MAX_FEEDS}개까지 넣을 수 있습니다.` };
    }
    const bad = urls.findIndex((u) => u.length > MAX_URL_LENGTH || !feedUrl(u));
    if (bad >= 0) {
      return {
        ok: false,
        message: `${bad + 1}번째 주소가 올바르지 않습니다. https:// 로 시작하는 iCal 비공개 주소를 넣어 주세요.`,
      };
    }
    return { ok: true, value: urls.join(",") };
  }
  const id = raw.trim();
  if (id && !CALENDAR_ID_RE.test(id)) {
    return { ok: false, message: "캘린더 ID가 올바르지 않습니다." };
  }
  return { ok: true, value: id };
}
