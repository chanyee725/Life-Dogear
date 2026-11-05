import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCalendar } from "@/lib/calendar";
import { clearIcsCache } from "@/lib/calendar/ics";
import { buildSettingsView, readOverrides, saveSetting, settingsEnv } from "@/lib/settings";
import { maskSecret, maskUrl } from "@/lib/settings/mask";
import { useFreshDb } from "./repo-helpers";

// Placeholders only; never real calendar addresses.
const APP_FEED = "https://calendar.example/ics/app-secret-token-aaaa/basic.ics";
const ENV_FEED = "https://calendar.example/ics/env-secret-token-bbbb/basic.ics";

describe("masking", () => {
  it("keeps only scheme and host of a URL", () => {
    expect(maskUrl(APP_FEED)).toBe("https://calendar.example/••••••");
    expect(maskUrl(APP_FEED)).not.toContain("secret");
  });
  it("keeps the first characters of other values, hides short ones", () => {
    expect(maskSecret("team-calendar@group.calendar.google.com")).toBe("team••••••");
    expect(maskSecret("abc")).toBe("••••••");
    expect(maskSecret("  ")).toBe("");
  });
});

describe("app settings", () => {
  beforeEach(async () => {
    await useFreshDb();
    clearIcsCache();
  });

  it("saves, normalizes and clears a value", async () => {
    await saveSetting(
      "GOOGLE_CALENDAR_ICS_URLS",
      ` ${APP_FEED} \n\n webcal://calendar.example/x.ics `,
    );
    expect(await readOverrides()).toEqual({
      GOOGLE_CALENDAR_ICS_URLS: `${APP_FEED},webcal://calendar.example/x.ics`,
    });
    await saveSetting("GOOGLE_CALENDAR_ICS_URLS", "");
    expect(await readOverrides()).toEqual({});
  });

  it("rejects bad values without echoing them", async () => {
    const secret = "http://calendar.example/plain-secret-zzzz.ics";
    await expect(saveSetting("GOOGLE_CALENDAR_ICS_URLS", secret)).rejects.toThrow(/1번째 주소/);
    await expect(saveSetting("GOOGLE_CALENDAR_ICS_URLS", secret)).rejects.not.toThrow(/zzzz/);
    await expect(saveSetting("GOOGLE_CALENDAR_ID", "bad id!")).rejects.toThrow(/캘린더 ID/);
  });

  it("refuses keys the app may not change", async () => {
    for (const key of [
      "ALLOWED_EMAILS",
      "AUTH_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
      "S3_BUCKET",
    ]) {
      await expect(saveSetting(key, "x")).rejects.toThrow(/바꿀 수 없는 설정/);
    }
  });

  it("app value wins over env; clearing falls back to env", async () => {
    const env = { GOOGLE_CALENDAR_ICS_URLS: ENV_FEED, GOOGLE_CALENDAR_ID: "env-cal" };
    expect((await settingsEnv(env)).GOOGLE_CALENDAR_ICS_URLS).toBe(ENV_FEED);
    await saveSetting("GOOGLE_CALENDAR_ICS_URLS", APP_FEED);
    await saveSetting("GOOGLE_CALENDAR_ID", "app-calendar@group.calendar.google.com");
    const merged = await settingsEnv(env);
    expect(merged.GOOGLE_CALENDAR_ICS_URLS).toBe(APP_FEED);
    expect(merged.GOOGLE_CALENDAR_ID).toBe("app-calendar@group.calendar.google.com");
    await saveSetting("GOOGLE_CALENDAR_ICS_URLS", " ");
    expect((await settingsEnv(env)).GOOGLE_CALENDAR_ICS_URLS).toBe(ENV_FEED);
  });

  it("the calendar reads the saved feed", async () => {
    await saveSetting("GOOGLE_CALENDAR_ICS_URLS", APP_FEED);
    const fetchMock = vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await getCalendar({ from: "2026-11-01", to: "2026-11-30" });
      expect(result.google).toBe("ok");
      expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(APP_FEED);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("settings view", () => {
  const env = {
    GOOGLE_CALENDAR_ICS_URLS: ENV_FEED,
    GOOGLE_OAUTH_CLIENT_ID: "client-id-secret",
    GOOGLE_OAUTH_CLIENT_SECRET: "client-secret-value",
    ALLOWED_EMAILS: "one@example.com, two@example.com",
    AUTH_SECRET: "auth-secret-value",
  };

  it("holds masks, names and counts only — no secret or email", () => {
    const view = buildSettingsView(
      env,
      { GOOGLE_CALENDAR_ID: "private@group.calendar.google.com" },
      "login",
    );
    expect(view.calendarRead).toEqual({
      source: "env",
      masked: ["https://calendar.example/••••••"],
    });
    expect(view.calendarId).toEqual({ source: "app", masked: "priv••••••" });
    expect(view.calendarWrite).toEqual({
      connected: false,
      missing: ["GOOGLE_OAUTH_REFRESH_TOKEN"],
    });
    expect(view.auth).toEqual({ mode: "login", allowedCount: 2 });
    const json = JSON.stringify(view);
    for (const secret of [
      "env-secret",
      "client-id-secret",
      "client-secret-value",
      "example.com",
      "auth-secret",
      "private@",
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it("reports app as the source when an override exists", () => {
    const view = buildSettingsView(env, { GOOGLE_CALENDAR_ICS_URLS: APP_FEED }, "local");
    expect(view.calendarRead.source).toBe("app");
    expect(view.calendarId).toEqual({ source: "none", masked: null });
  });
});
