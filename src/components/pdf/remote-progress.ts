import { samePosition, type Position } from "./layout";

/** Saved position as returned by `GET /api/papers/<id>/progress`. */
export type RemoteProgress = {
  page: number | null;
  scroll: number | null;
  totalPages: number | null;
  lastReadAt: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseRemoteProgress(value: unknown): RemoteProgress | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return {
    page: num(v.page),
    scroll: num(v.scroll),
    totalPages: num(v.totalPages),
    lastReadAt: typeof v.lastReadAt === "string" ? v.lastReadAt : null,
  };
}

const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? null : t;
};

/** True when `candidate` is a later timestamp than `known` (or `known` is unset). */
export function isLaterReadAt(candidate: string | null, known: string | null): boolean {
  const c = time(candidate);
  if (c === null) return false;
  const k = time(known);
  return k === null || c > k;
}

/** The later of two read timestamps. */
export function laterReadAt(a: string | null, b: string | null): string | null {
  return isLaterReadAt(a, b) ? a : b;
}

/**
 * Position to jump to after checking the server, or null to stay put. The server
 * wins only when it was read later than anything this page knows about, the user
 * has no unsaved position of their own, and it is actually somewhere else.
 */
export function newerRemotePosition(
  remote: RemoteProgress,
  knownReadAt: string | null,
  current: Position | null,
  hasUnsavedPosition: boolean,
): Position | null {
  if (hasUnsavedPosition || !remote.page) return null;
  if (!isLaterReadAt(remote.lastReadAt, knownReadAt)) return null;
  const position = { page: remote.page, scroll: remote.scroll ?? 0 };
  return current && samePosition(position, current) ? null : position;
}
