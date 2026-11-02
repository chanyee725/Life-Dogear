/**
 * Validation for values crossing the server-action boundary. Anything coming from
 * the client is `unknown`; these helpers narrow it or throw RepoError("invalid"),
 * which `runAction` turns into a Korean error message.
 *
 * Convention: `undefined` means "field not sent" and is passed through so patch
 * updates leave the column alone.
 */
import { ITEM_ROUTE, ITEM_TYPE } from "@/lib/enums";
import { RepoError, type ItemRef } from "@/lib/repo";

const invalid = (field: string) => new RepoError("invalid", `${field} 값이 올바르지 않습니다.`);

export const MAX_TITLE = 300;
export const MAX_TEXT = 2_000;
export const MAX_BODY = 500_000;
const MAX_ID = 100;

export function parseItemRef(value: unknown, field = "항목"): ItemRef {
  if (!value || typeof value !== "object") throw invalid(field);
  const { type, id } = value as Record<string, unknown>;
  return { type: parseEnum(ITEM_TYPE, type, field), id: parseId(id, field) };
}

export function parseId(value: unknown, field = "id"): string {
  if (typeof value !== "string") throw invalid(field);
  const id = value.trim();
  if (!id || id.length > MAX_ID) throw invalid(field);
  return id;
}

export function parseEnum<V extends string>(
  e: { is: (v: unknown) => v is V },
  value: unknown,
  field: string,
): V {
  if (!e.is(value)) throw invalid(field);
  return value;
}

export function optionalEnum<V extends string>(
  e: { is: (v: unknown) => v is V },
  value: unknown,
  field: string,
): V | undefined {
  return value === undefined ? undefined : parseEnum(e, value, field);
}

/** Required string (not trimmed here — the repo trims and checks emptiness). */
export function parseText(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string" || value.length > max) throw invalid(field);
  return value;
}

/** Optional string; `null` is treated as an empty string. */
export function optionalText(value: unknown, field: string, max = MAX_TEXT): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "";
  return parseText(value, field, max);
}

/** Optional nullable string, e.g. dates: `null`/"" clear the value. */
export function optionalNullableText(
  value: unknown,
  field: string,
  max = MAX_TEXT,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parseText(value, field, max);
}

/** Optional integer; accepts numeric strings from forms, `null`/"" clear it. */
export function optionalInt(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) throw invalid(field);
  return n;
}

/**
 * Optional list of strings. Accepts an array of strings or a comma/newline separated
 * string (form inputs). Empty entries are dropped.
 */
export function optionalStringList(
  value: unknown,
  field: string,
  maxItems = 100,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  const list = typeof value === "string" ? value.split(/[,\n]/) : value;
  if (!Array.isArray(list) || list.length > maxItems) throw invalid(field);
  return list
    .map((item) => {
      if (typeof item !== "string" || item.length > MAX_TEXT) throw invalid(field);
      return item.trim();
    })
    .filter(Boolean);
}

/** Reads a text field from FormData; files are rejected, missing → undefined. */
export function formText(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (value === null) return undefined;
  if (typeof value !== "string") throw invalid(key);
  return value;
}

/** Detail page path of an item, e.g. `/papers/<id>`. */
export const itemPath = (ref: ItemRef): string => `${ITEM_ROUTE[ref.type]}/${ref.id}`;
