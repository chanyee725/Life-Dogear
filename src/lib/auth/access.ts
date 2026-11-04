import type { AuthMode } from "./mode";

/**
 * Per-request access decision (pure; the middleware applies it after the Host check).
 *
 * Every path goes through the middleware. Without sign-in only these stay reachable:
 * `/_next/static/**` (build assets; in dev also `/_next/webpack-hmr`), `/favicon.ico`,
 * `/robots.txt`, `/api/auth/**` (Auth.js), and the sign-in, refusal and setup pages.
 * Pages redirect, `/api/**` answers JSON.
 *
 * Signed out (or in setup mode) only GET/HEAD reach pages and assets: any other method is
 * refused. A POST with `Next-Action` to an open page would otherwise run any server action
 * imported by the root layout.
 */

export const LOGIN_PATH = "/login";
export const DENIED_PATH = "/denied";
export const SETUP_PATH = "/setup";
const AUTH_PAGES = new Set([LOGIN_PATH, DENIED_PATH, SETUP_PATH]);
const STATIC_FILES = new Set(["/favicon.ico", "/robots.txt"]);

export type Access =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "json"; status: number; error: string };

export const LOGIN_REQUIRED_MESSAGE = "로그인이 필요합니다.";
export const SETUP_REQUIRED_MESSAGE = "설정이 끝나지 않아 사용할 수 없습니다.";
export const FORBIDDEN_REQUEST_MESSAGE = "허용되지 않은 요청입니다.";

const NEXT: Access = { type: "next" };

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isApiPath = (pathname: string) => under(pathname, "/api");
export const isAuthApiPath = (pathname: string) => under(pathname, "/api/auth");

/** Build assets and the few root static files: no data, served in every mode. */
export function isAssetPath(pathname: string, dev = false): boolean {
  if (pathname.startsWith("/_next/static/") || STATIC_FILES.has(pathname)) return true;
  return dev && pathname === "/_next/webpack-hmr";
}

const isReadMethod = (method: string) => {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD";
};

/**
 * A same-site path to return to after sign-in, or `/`. Rejects absolute and
 * protocol-relative URLs, backslashes and control characters (open redirect).
 */
export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return "/";
  } catch {
    return "/";
  }
  if (AUTH_PAGES.has(value.split(/[?#]/)[0])) return "/";
  return value;
}

export function decideAccess(input: {
  mode: AuthMode;
  /** Request method; only GET/HEAD reach open pages and assets while signed out. */
  method: string;
  pathname: string;
  /** `?…` part of the request URL, kept for the return path. */
  search: string;
  /** Signed in with an allowed email (only meaningful in `login` mode). */
  signedIn: boolean;
  /** `next dev`: also lets the hot-reload socket through. */
  dev?: boolean;
}): Access {
  const { mode, method, pathname, search, signedIn, dev = false } = input;
  const read = isReadMethod(method);

  if (mode.kind === "local") {
    if (isAssetPath(pathname, dev)) return NEXT;
    // No Auth.js without its settings; the sign-in pages have nothing to do.
    if (isAuthApiPath(pathname)) return { type: "json", status: 404, error: "없는 주소입니다." };
    if (AUTH_PAGES.has(pathname)) return { type: "redirect", to: "/" };
    return NEXT;
  }

  if (mode.kind === "setup") {
    if (isApiPath(pathname)) return { type: "json", status: 503, error: SETUP_REQUIRED_MESSAGE };
    if (!read) return { type: "json", status: 403, error: FORBIDDEN_REQUEST_MESSAGE };
    if (isAssetPath(pathname, dev) || pathname === SETUP_PATH) return NEXT;
    return { type: "redirect", to: SETUP_PATH };
  }

  // login
  if (isAuthApiPath(pathname)) return NEXT;
  if (signedIn) {
    if (pathname === SETUP_PATH) return { type: "redirect", to: "/" };
    return NEXT;
  }
  if (isApiPath(pathname)) return { type: "json", status: 401, error: LOGIN_REQUIRED_MESSAGE };
  if (!read) return { type: "json", status: 403, error: FORBIDDEN_REQUEST_MESSAGE };
  if (isAssetPath(pathname, dev)) return NEXT;
  if (pathname === LOGIN_PATH || pathname === DENIED_PATH) return NEXT;
  if (pathname === SETUP_PATH) return { type: "redirect", to: "/" };
  const back = safeNextPath(`${pathname}${search}`);
  return {
    type: "redirect",
    to: back === "/" ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(back)}`,
  };
}
