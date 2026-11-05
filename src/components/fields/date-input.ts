/**
 * Typed-date parsing for `DateField`: the field shows `YYYY.MM.DD` and stores `YYYY-MM-DD`.
 */

const STRICT = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})\.?$|^(\d{4})(\d{2})(\d{2})$/;
const LOOSE = /^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?$|^(\d{4})(\d{2})(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `YYYY-MM-DD` for typed text, "" for blank, null when it is not (yet) a real date.
 * Accepts `YYYY.MM.DD`, `YYYY-MM-DD`, `YYYY/MM/DD` and `YYYYMMDD`. `loose` (on blur or
 * Enter) also takes one-digit month/day (`2026.1.5`); while typing it would fire too early
 * (`2026.11.1` on the way to `2026.11.15`).
 */
export function parseDateInput(text: string, loose = false): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const m = (loose ? LOOSE : STRICT).exec(trimmed);
  if (!m) return null;
  const year = Number(m[1] ?? m[4]);
  const month = Number(m[2] ?? m[5]);
  const day = Number(m[3] ?? m[6]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Local-midnight `Date` for a `YYYY-MM-DD` string (what the calendar grid expects). */
export function isoToDate(iso: string | null | undefined): Date | undefined {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

/** `YYYY-MM-DD` for a calendar day (local fields, no timezone shift). */
export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
