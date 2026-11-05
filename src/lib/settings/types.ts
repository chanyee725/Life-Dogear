/** What `/settings` shows. Built on the server; holds no secret value, only masks and names. */

/** Settings the app may store (DB value overrides the env var of the same name). */
export const EDITABLE_KEYS = ["GOOGLE_CALENDAR_ICS_URLS", "GOOGLE_CALENDAR_ID"] as const;
export type EditableKey = (typeof EDITABLE_KEYS)[number];

export const isEditableKey = (key: unknown): key is EditableKey =>
  typeof key === "string" && (EDITABLE_KEYS as readonly string[]).includes(key);

/** `app`: saved in the app (wins); `env`: server environment; `none`: not set. */
export type SettingSource = "app" | "env" | "none";

export type SettingsView = {
  calendarRead: { source: SettingSource; masked: string[] };
  /** Masked calendar id; null = default (`primary`). */
  calendarId: { source: SettingSource; masked: string | null };
  /** OAuth keys are server secrets: names of the missing ones only. */
  calendarWrite: { connected: boolean; missing: string[] };
  storage: { kind: "s3" | "local"; missing: string[] };
  /** No addresses: only how many accounts may sign in. */
  auth: { mode: "login" | "local" | "setup"; allowedCount: number };
};
