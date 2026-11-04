import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { decideAccess, safeNextPath } from "@/lib/auth/access";
import type { AuthMode } from "@/lib/auth/mode";

const LOGIN: AuthMode = { kind: "login" };
const LOCAL: AuthMode = { kind: "local" };
const SETUP: AuthMode = { kind: "setup", reasons: ["auth-required"], missing: ["AUTH_SECRET"] };

const decide = (mode: AuthMode, path: string, signedIn = false, method = "GET", dev = false) => {
  const url = new URL(path, "http://127.0.0.1:3000");
  return decideAccess({ mode, method, pathname: url.pathname, search: url.search, signedIn, dev });
};

/** Every page and route handler under src/app, as a concrete URL path. */
function appRoutes(): string[] {
  const root = join(process.cwd(), "src", "app");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/^(page|route)\.tsx?$/.test(name)) {
        const segments = relative(root, dir)
          .split(sep)
          .filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("_") && !s.startsWith("@"))
          .map((s) => (s.startsWith("[") ? "x" : s));
        out.push(`/${segments.join("/")}`);
      }
    }
  };
  walk(root);
  return out;
}

const PUBLIC_IN_LOGIN = new Set(["/login", "/denied"]);

describe("decideAccess", () => {
  it("keeps build assets and Auth.js endpoints reachable", () => {
    for (const mode of [LOGIN, LOCAL, SETUP]) {
      expect(decide(mode, "/_next/static/chunks/a.js")).toEqual({ type: "next" });
      expect(decide(mode, "/favicon.ico")).toEqual({ type: "next" });
      expect(decide(mode, "/_next/webpack-hmr", false, "GET", true)).toEqual({ type: "next" });
    }
    expect(decide(LOGIN, "/api/auth/signin/google", false, "POST")).toEqual({ type: "next" });
    for (const method of ["GET", "POST"]) {
      expect(decide(LOGIN, "/api/auth", false, method)).toMatchObject({
        type: "json",
        status: 404,
      });
    }
    expect(decide(LOGIN, "/api/auth/callback/google?code=1")).toEqual({ type: "next" });
    expect(decide(LOGIN, "/api/auth/session")).toEqual({ type: "next" });
  });

  it("login mode: pages redirect to sign-in with a return path, APIs answer 401", () => {
    expect(decide(LOGIN, "/")).toEqual({ type: "redirect", to: "/login" });
    expect(decide(LOGIN, "/papers/abc?tab=pdf")).toEqual({
      type: "redirect",
      to: `/login?next=${encodeURIComponent("/papers/abc?tab=pdf")}`,
    });
    expect(decide(LOGIN, "/api/search?q=x")).toEqual({
      type: "json",
      status: 401,
      error: "로그인이 필요합니다.",
    });
    expect(decide(LOGIN, "/api")).toMatchObject({ status: 401 });
    expect(decide(LOGIN, "/api/papers/x/pdf", true)).toEqual({ type: "next" });
    expect(decide(LOGIN, "/papers", true)).toEqual({ type: "next" });
    expect(decide(LOGIN, "/login")).toEqual({ type: "next" });
    expect(decide(LOGIN, "/denied")).toEqual({ type: "next" });
    expect(decide(LOGIN, "/setup")).toEqual({ type: "redirect", to: "/" });
  });

  it("login mode: look-alike paths are not public", () => {
    for (const path of [
      "/loginx",
      "/login/x",
      "/api/authx",
      "/api/author",
      "/_nextx/a.js",
      "/_next",
      "/favicon.ico/x",
      "/api/images/x.png",
      "/api/pdfjs/pdf.worker.min.mjs",
    ]) {
      expect(decide(LOGIN, path).type, path).not.toBe("next");
    }
  });

  it("only /_next/static (and the dev HMR socket in dev) is open under /_next", () => {
    for (const mode of [LOGIN, SETUP]) {
      for (const path of ["/_next/image?url=/x", "/_next/data/b/x.json", "/_next/webpack-hmr"]) {
        expect(decide(mode, path).type, path).not.toBe("next");
      }
    }
  });

  it("signed out / setup: no POST (server actions) to any page, asset or API", () => {
    const action = (mode: AuthMode, path: string, method = "POST") =>
      decide(mode, path, false, method);
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      for (const path of [
        "/login",
        "/denied",
        "/",
        "/papers",
        "/_next/static/a.js",
        "/favicon.ico",
      ]) {
        expect(action(LOGIN, path, method), `${method} ${path}`).toMatchObject({
          type: "json",
          status: 403,
        });
      }
      expect(action(LOGIN, "/api/search", method)).toMatchObject({ status: 401 });
      expect(action(SETUP, "/setup", method)).toMatchObject({ type: "json", status: 403 });
      expect(action(SETUP, "/_next/static/a.js", method)).toMatchObject({ status: 403 });
      expect(action(SETUP, "/api/search", method)).toMatchObject({ status: 503 });
    }
    expect(decide(LOGIN, "/login", false, "HEAD")).toEqual({ type: "next" });
    // Signed in: server actions work as before.
    expect(decide(LOGIN, "/papers", true, "POST")).toEqual({ type: "next" });
    expect(decide(LOCAL, "/papers", false, "POST")).toEqual({ type: "next" });
  });

  it("local mode: unchanged, no Auth.js endpoints or sign-in pages", () => {
    expect(decide(LOCAL, "/")).toEqual({ type: "next" });
    expect(decide(LOCAL, "/api/search?q=x")).toEqual({ type: "next" });
    expect(decide(LOCAL, "/api/auth/session")).toMatchObject({ type: "json", status: 404 });
    for (const path of ["/login", "/denied", "/setup"]) {
      expect(decide(LOCAL, path)).toEqual({ type: "redirect", to: "/" });
    }
  });

  it("setup mode: only the setup page opens", () => {
    expect(decide(SETUP, "/setup")).toEqual({ type: "next" });
    expect(decide(SETUP, "/")).toEqual({ type: "redirect", to: "/setup" });
    expect(decide(SETUP, "/login")).toEqual({ type: "redirect", to: "/setup" });
    expect(decide(SETUP, "/api/search")).toMatchObject({ type: "json", status: 503 });
    expect(decide(SETUP, "/api/auth/session")).toMatchObject({ type: "json", status: 503 });
  });

  it("protects every app route in login mode (matcher has no gaps)", () => {
    const routes = appRoutes();
    expect(routes).toContain("/");
    expect(routes).toContain("/api/search");
    expect(routes).toContain("/login");
    for (const path of routes) {
      const access = decide(LOGIN, path);
      if (PUBLIC_IN_LOGIN.has(path) || path.startsWith("/api/auth/")) {
        expect(access.type, path).toBe("next");
      } else if (path === "/setup") {
        expect(access, path).toEqual({ type: "redirect", to: "/" });
      } else if (path.startsWith("/api/")) {
        expect(access, path).toMatchObject({ type: "json", status: 401 });
      } else {
        expect(access.type, path).toBe("redirect");
      }
    }
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/papers/abc?tab=pdf#p2")).toBe("/papers/abc?tab=pdf#p2");
    expect(safeNextPath("/")).toBe("/");
  });

  it("rejects anything that could leave the site or loop", () => {
    for (const value of [
      null,
      undefined,
      "",
      "https://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "/a\nb",
      "/login",
      "/login?next=/x",
      "/denied",
      "papers",
    ]) {
      expect(safeNextPath(value), String(value)).toBe("/");
    }
  });
});

describe("middleware", () => {
  const SECRET = "test-secret-for-unit-tests-only-0123456789";
  const COOKIE = "authjs.session-token";

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const request = (path: string, cookie?: string) =>
    new NextRequest(`http://127.0.0.1:3000${path}`, {
      // Next adds x-forwarded-proto; Auth.js picks the (non-__Secure-) cookie name from it.
      headers: {
        host: "127.0.0.1:3000",
        "x-forwarded-proto": "http",
        ...(cookie ? { cookie } : {}),
      },
    });

  const sessionCookie = async (email: string) =>
    `${COOKIE}=${await encode({ token: { email, sub: "1" }, secret: SECRET, salt: COOKIE })}`;

  const loginEnv = () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
    vi.stubEnv("ALLOWED_EMAILS", "You@Example.com");
  };

  it("without auth settings on this machine: passes everything through", async () => {
    for (const key of ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ALLOWED_EMAILS"]) {
      vi.stubEnv(key, "");
    }
    vi.stubEnv("VERCEL", "");
    const { middleware } = await import("@/middleware");
    const res = await middleware(request("/papers"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("on Vercel without settings: setup page", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("ALLOWED_HOSTS", "app.vercel.app");
    for (const key of ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ALLOWED_EMAILS"]) {
      vi.stubEnv(key, "");
    }
    const { middleware } = await import("@/middleware");
    const page = await middleware(
      new NextRequest("https://app.vercel.app/", { headers: { host: "app.vercel.app" } }),
    );
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location")!).pathname).toBe("/setup");
    const api = await middleware(
      new NextRequest("https://app.vercel.app/api/search", { headers: { host: "app.vercel.app" } }),
    );
    expect(api.status).toBe(503);
  });

  it("login mode: no session → redirect / 401", async () => {
    loginEnv();
    const { middleware } = await import("@/middleware");
    const page = await middleware(request("/papers?x=1"));
    expect(page.status).toBe(307);
    const location = new URL(page.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/papers?x=1");
    const api = await middleware(request("/api/search?q=a"));
    expect(api.status).toBe(401);
    expect(await api.json()).toEqual({ error: "로그인이 필요합니다." });
  });

  it("login mode: an allowed session passes, case-insensitively", async () => {
    loginEnv();
    const { middleware } = await import("@/middleware");
    const cookie = await sessionCookie("you@example.com");
    expect((await middleware(request("/papers", cookie))).headers.get("x-middleware-next")).toBe(
      "1",
    );
    expect((await middleware(request("/api/search", cookie))).status).not.toBe(401);
  });

  it("login mode: a session for an address not in the list is refused", async () => {
    loginEnv();
    const { middleware } = await import("@/middleware");
    const cookie = await sessionCookie("someone@example.com");
    expect((await middleware(request("/api/search", cookie))).status).toBe(401);
    expect((await middleware(request("/", cookie))).status).toBe(307);
  });

  it("login mode: a forged cookie is refused", async () => {
    loginEnv();
    const { middleware } = await import("@/middleware");
    const forged = `${COOKIE}=${await encode({
      token: { email: "you@example.com" },
      secret: "another-secret-another-secret-0123456789",
      salt: COOKIE,
    })}`;
    expect((await middleware(request("/api/search", forged))).status).toBe(401);
  });

  it("login mode: a server-action POST to /login while signed out is refused", async () => {
    loginEnv();
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      new NextRequest("http://127.0.0.1:3000/login", {
        method: "POST",
        headers: { host: "127.0.0.1:3000", "next-action": "abc123", "x-forwarded-proto": "http" },
        body: "[]",
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("x-middleware-next")).toBeNull();
  });

  it("still rejects foreign hosts first", async () => {
    loginEnv();
    const { middleware } = await import("@/middleware");
    const res = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/auth/session", {
        headers: { host: "attacker.example" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("matches every path", async () => {
    const { config } = await import("@/middleware");
    expect(config).toEqual({ matcher: "/:path*" });
  });
});
