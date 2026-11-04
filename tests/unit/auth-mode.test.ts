import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails } from "@/lib/auth/allowlist";
import { AUTH_KEYS, resolveAuthMode, S3_KEYS } from "@/lib/auth/mode";

const AUTH = {
  AUTH_SECRET: "s",
  AUTH_GOOGLE_ID: "id",
  AUTH_GOOGLE_SECRET: "gs",
  ALLOWED_EMAILS: "you@example.com",
};
const S3 = {
  S3_ENDPOINT: "https://r2.example.com",
  S3_BUCKET: "b",
  S3_ACCESS_KEY_ID: "k",
  S3_SECRET_ACCESS_KEY: "sk",
};

describe("resolveAuthMode", () => {
  it("requires sign-in when all four auth settings are set", () => {
    expect(resolveAuthMode(AUTH, "127.0.0.1:3000")).toEqual({ kind: "login" });
    expect(resolveAuthMode({ ...AUTH, NODE_ENV: "production" }, "my-box.local")).toEqual({
      kind: "login",
    });
    expect(resolveAuthMode({ ...AUTH, ...S3, VERCEL: "1" }, "app.vercel.app")).toEqual({
      kind: "login",
    });
  });

  it("stays open without sign-in on this machine when nothing is set", () => {
    for (const host of ["127.0.0.1:3000", "localhost:3000", "[::1]:3000"]) {
      expect(resolveAuthMode({}, host)).toEqual({ kind: "local" });
      expect(resolveAuthMode({ NODE_ENV: "production" }, host)).toEqual({ kind: "local" });
    }
    // Dev server on an ALLOWED_HOSTS name: unchanged behaviour (host guard decides).
    expect(resolveAuthMode({ NODE_ENV: "development" }, "my-box.local:3000")).toEqual({
      kind: "local",
    });
  });

  it("treats blank values as unset", () => {
    const blank = Object.fromEntries(AUTH_KEYS.map((k) => [k, "  "]));
    expect(resolveAuthMode(blank, "127.0.0.1:3000")).toEqual({ kind: "local" });
  });

  it("shows setup on Vercel without auth settings, even for a local-looking Host", () => {
    for (const host of ["app.vercel.app", "localhost", null]) {
      const mode = resolveAuthMode({ ...S3, VERCEL: "1" }, host);
      expect(mode).toEqual({ kind: "setup", reasons: ["auth-required"], missing: [...AUTH_KEYS] });
    }
  });

  it("shows setup for a production server on a remote host without auth settings", () => {
    for (const host of ["my-box.local:3100", "", null, "evil.example"]) {
      const mode = resolveAuthMode({ NODE_ENV: "production" }, host);
      expect(mode.kind).toBe("setup");
    }
  });

  it("shows setup when auth settings are only partly filled, anywhere", () => {
    const partial = { ...AUTH, ALLOWED_EMAILS: "" };
    const mode = resolveAuthMode(partial, "127.0.0.1:3000");
    expect(mode).toEqual({
      kind: "setup",
      reasons: ["auth-incomplete"],
      missing: ["ALLOWED_EMAILS"],
    });
  });

  it("on Vercel requires shared file storage too", () => {
    expect(resolveAuthMode({ ...AUTH, VERCEL: "1" }, "app.vercel.app")).toEqual({
      kind: "setup",
      reasons: ["storage-required"],
      missing: [...S3_KEYS],
    });
    const partialS3 = { ...S3, S3_BUCKET: undefined };
    expect(resolveAuthMode({ VERCEL: "1", ...partialS3 }, "app.vercel.app")).toEqual({
      kind: "setup",
      reasons: ["auth-required", "storage-required"],
      missing: [...AUTH_KEYS, "S3_BUCKET"],
    });
    expect(
      resolveAuthMode({ ...AUTH, ...S3, VERCEL: "1", BLOB_STORE: "local" }, "app.vercel.app"),
    ).toEqual({ kind: "setup", reasons: ["storage-required"], missing: ["BLOB_STORE"] });
  });

  it("never echoes setting values", () => {
    const mode = resolveAuthMode({ AUTH_SECRET: "top-secret-value" }, "127.0.0.1");
    expect(JSON.stringify(mode)).not.toContain("top-secret-value");
  });
});

describe("allowed emails", () => {
  it("parses a comma list, trimmed and lower-cased", () => {
    expect([...parseAllowedEmails(" You@Example.com , ,other@example.org ")]).toEqual([
      "you@example.com",
      "other@example.org",
    ]);
    expect(parseAllowedEmails(undefined).size).toBe(0);
    expect(parseAllowedEmails("").size).toBe(0);
  });

  it("matches case-insensitively and nothing else", () => {
    const allowed = parseAllowedEmails("you@example.com");
    expect(isAllowedEmail("you@example.com", allowed)).toBe(true);
    expect(isAllowedEmail("YOU@EXAMPLE.COM", allowed)).toBe(true);
    expect(isAllowedEmail(" you@example.com ", allowed)).toBe(true);
    for (const email of [
      null,
      undefined,
      "",
      "someone@example.com",
      "you@example.com.evil.example",
      "you@example.co",
      "xyou@example.com",
    ]) {
      expect(isAllowedEmail(email, allowed)).toBe(false);
    }
    expect(isAllowedEmail("", parseAllowedEmails(""))).toBe(false);
  });
});
