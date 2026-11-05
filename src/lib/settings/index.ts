import "server-only";
/**
 * App-editable settings (`app_settings`). A non-empty saved value overrides the env var of
 * the same name; clearing it falls back to the env. Values may be secrets: they never leave
 * the server unmasked and are never logged (errors are logged by name only).
 */
import { eq, inArray } from "drizzle-orm";
import { appSettings } from "@/db/schema";
import { describeError } from "@/lib/storage/describe-error";
import { db, nowIso, RepoError } from "@/lib/repo/shared";
import { parseAllowedEmails } from "@/lib/auth/allowlist";
import { S3_KEYS } from "@/lib/auth/mode";
import { blobStoreKind } from "@/lib/storage/blob";
import { maskSecret, maskUrl } from "./mask";
import {
  EDITABLE_KEYS,
  isEditableKey,
  type EditableKey,
  type SettingSource,
  type SettingsView,
} from "./types";
import { validateSetting } from "./validate";

export * from "./types";

type Env = Readonly<Record<string, string | undefined>>;
export type Overrides = Partial<Record<EditableKey, string>>;

const WRITE_KEYS = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN",
] as const;

/** Saved, non-empty app values. */
export async function readOverrides(): Promise<Overrides> {
  const rows = await db()
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...EDITABLE_KEYS]));
  const out: Overrides = {};
  for (const r of rows) if (isEditableKey(r.key) && r.value.trim()) out[r.key] = r.value;
  return out;
}

/** `base` with the saved values on top (app wins over env). Pure. */
export function mergeEnv(base: Env, overrides: Overrides): Env {
  return { ...base, ...overrides };
}

/**
 * The environment the calendar should use: `process.env` plus saved values. A database
 * failure falls back to the env alone, so the calendar keeps working.
 */
export async function settingsEnv(base: Env = process.env): Promise<Env> {
  try {
    return mergeEnv(base, await readOverrides());
  } catch (error) {
    console.warn("[settings] could not read app settings", describeError(error));
    return base;
  }
}

/** Saves (or, with an empty value, clears) one app setting. Throws `RepoError` with a user message. */
export async function saveSetting(key: unknown, raw: unknown): Promise<void> {
  if (!isEditableKey(key)) throw new RepoError("invalid", "바꿀 수 없는 설정입니다.");
  const result = validateSetting(key, raw);
  if (!result.ok) throw new RepoError("invalid", result.message);
  if (!result.value) {
    await db().delete(appSettings).where(eq(appSettings.key, key));
    return;
  }
  const updatedAt = nowIso();
  await db()
    .insert(appSettings)
    .values({ key, value: result.value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: result.value, updatedAt } });
}

const sourceOf = (key: EditableKey, overrides: Overrides, env: Env): SettingSource =>
  overrides[key] ? "app" : env[key]?.trim() ? "env" : "none";

const filled = (env: Env, key: string) => Boolean(env[key]?.trim());

/**
 * Everything `/settings` shows, masked here on the server. `authMode` comes from the
 * request (it depends on the Host header).
 */
export function buildSettingsView(
  env: Env,
  overrides: Overrides,
  authMode: SettingsView["auth"]["mode"],
): SettingsView {
  const merged = mergeEnv(env, overrides);
  const feeds = (merged.GOOGLE_CALENDAR_ICS_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const calendarId = merged.GOOGLE_CALENDAR_ID?.trim();
  const missingWrite = WRITE_KEYS.filter((k) => !filled(env, k));
  return {
    calendarRead: {
      source: sourceOf("GOOGLE_CALENDAR_ICS_URLS", overrides, env),
      masked: feeds.map(maskUrl),
    },
    calendarId: {
      source: sourceOf("GOOGLE_CALENDAR_ID", overrides, env),
      masked: calendarId ? maskSecret(calendarId) : null,
    },
    calendarWrite: { connected: missingWrite.length === 0, missing: missingWrite },
    storage: {
      kind: blobStoreKind(env),
      missing: S3_KEYS.filter((k) => !filled(env, k)),
    },
    auth: {
      mode: authMode,
      allowedCount: parseAllowedEmails(env.ALLOWED_EMAILS).size,
    },
  };
}

/** View with the saved values read from the database (env only if that fails). */
export async function settingsView(
  authMode: SettingsView["auth"]["mode"],
  env: Env = process.env,
): Promise<SettingsView> {
  let overrides: Overrides = {};
  try {
    overrides = await readOverrides();
  } catch (error) {
    console.warn("[settings] could not read app settings", describeError(error));
  }
  return buildSettingsView(env, overrides, authMode);
}
