/** Wall-clock ↔ instant conversion for IANA zones with `Intl` (no zone database shipped). */

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Whether `Intl` knows the zone (e.g. `Asia/Seoul`; Outlook names like "Korea Standard Time" are not). */
export function isKnownZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    formatter(zone);
    return true;
  } catch {
    return false;
  }
}

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(zone, f);
  }
  return f;
}

/** Offset of `zone` from UTC at instant `ms`, in minutes. */
function offsetMinutes(ms: number, zone: string): number {
  const parts = Object.fromEntries(
    formatter(zone)
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

export type WallClock = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Instant (ms) of a wall-clock time in `zone`. */
export function wallToMs(w: WallClock, zone: string): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  let ms = guess - offsetMinutes(guess, zone) * 60_000;
  // Second pass settles times near a DST change.
  ms = guess - offsetMinutes(ms, zone) * 60_000;
  return ms;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DDTHH:mm:ss+09:00` for instant `ms` in `zone`; its first 10 chars are the local day. */
export function msToZonedIso(ms: number, zone: string): string {
  const off = offsetMinutes(ms, zone);
  const local = new Date(ms + off * 60_000);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
