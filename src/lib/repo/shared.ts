import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb, type Db } from "@/db/client";
import { itemTags, tags } from "@/db/schema";
import { ITEM_TYPE, type ItemType } from "@/lib/enums";

export type { ItemType } from "@/lib/enums";
export type ItemRef = { type: ItemType; id: string };

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the database or an open transaction. */
export type Executor = Db | Tx;

export type RepoErrorCode = "invalid" | "not_found";

export class RepoError extends Error {
  constructor(
    readonly code: RepoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RepoError";
  }
}

export const db = (): Db => getDb();

// One SQLite connection cannot run overlapping write transactions (SQLITE_BUSY /
// TRANSACTION_ACTIVE), so every write in this process goes through one queue.
// Kept on globalThis so dev-server hot reloads share the same queue.
const writeQueue = globalThis as unknown as { __researchBrainWrites?: Promise<unknown> };

/** Runs `fn` after all previously queued writes have settled. */
export function serializeWrite<T>(fn: () => Promise<T>): Promise<T> {
  const previous = writeQueue.__researchBrainWrites ?? Promise.resolve();
  const run = previous.then(fn, fn);
  writeQueue.__researchBrainWrites = run.catch(() => undefined);
  return run;
}

/** Serialized write transaction. Never call another `withTx` inside `fn` (it would deadlock). */
export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return serializeWrite(() => db().transaction(fn));
}

/** Order clauses for `sort`, falling back to `fallback` for unknown values. */
export function orderFor<K extends string>(
  orders: Record<K, SQL[]>,
  sort: unknown,
  fallback: K,
): SQL[] {
  return typeof sort === "string" && Object.hasOwn(orders, sort)
    ? orders[sort as K]
    : orders[fallback];
}

export const nowIso = (): string => new Date().toISOString();

export const newId = (): string => crypto.randomUUID();

export function assertItemRef(ref: ItemRef): void {
  if (!ref || !ITEM_TYPE.is(ref.type) || typeof ref.id !== "string" || !ref.id) {
    throw new RepoError("invalid", "잘못된 항목 참조입니다.");
  }
}

export function requireTitle(title: unknown): string {
  const value = typeof title === "string" ? title.trim() : "";
  if (!value) throw new RepoError("invalid", "제목을 입력하세요.");
  return value;
}

export function requireEnum<V extends string>(
  e: { is: (v: unknown) => v is V },
  value: unknown,
  field: string,
): V {
  if (!e.is(value)) throw new RepoError("invalid", `${field} 값이 올바르지 않습니다.`);
  return value;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD`, or null for empty input. */
export function optionalDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new RepoError("invalid", `${field} 날짜 형식이 올바르지 않습니다.`);
  }
  return value;
}

export const trimText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Copies only the keys that are present (not undefined) in `patch`. */
export function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** WHERE clause: `idColumn` belongs to an item of `type` tagged `tagName` (case-insensitive). */
export function hasTag(
  exec: Executor,
  type: ItemType,
  idColumn: SQLiteColumn,
  tagName: string,
): SQL {
  const sub = exec
    .select({ id: itemTags.itemId })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(
      and(
        eq(itemTags.itemType, type),
        sql`lower(${tags.name}) = lower(${tagName.normalize("NFC").trim()})`,
      ),
    );
  return inArray(idColumn, sub);
}

export const descNullsLast = (col: SQLiteColumn): SQL => sql`${col} desc nulls last`;
export const ascNullsLast = (col: SQLiteColumn): SQL => sql`${col} asc nulls last`;
