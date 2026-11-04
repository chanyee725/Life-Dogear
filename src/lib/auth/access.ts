import type { AuthMode } from "./mode";

/**
 * Per-request access decision (pure; the middleware applies it after the Host check).
 *
 * Every path goes through the middleware. Without sign-in only these stay reachable:
 * `/_next/**` (build assets), `/favicon.ico`, `/robots.txt`, `/api/auth/**` (Auth.js),
 * and the sign-in, refusal and setup pages. Pages redirect, `/api/**` answers JSON.
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

const NEXT: Access = { type: "next" };

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isApiPath = (pathname: string) => under(pathname, "/api");
export const isAuthApiPath = (pathname: string) => under(pathname, "/api/auth");

/** Build assets and the few root static files: no data, served in every mode. */
export function isAssetPath(pathname: string): boolean {
  return pathname.startsWith("/_next/") || STATIC_FILES.has(pathname);
}

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
  pathname: string;
  /** `?…` part of the request URL, kept for the return path. */
  search: string;
  /** Signed in with an allowed email (only meaningful in `login` mode). */
  signedIn: boolean;
}): Access {
  const { mode, pathname, search, signedIn } = input;
  if (isAssetPath(pathname)) return NEXT;

  if (mode.kind === "setup") {
    if (pathname === SETUP_PATH) return NEXT;
    if (isApiPath(pathname)) return { type: "json", status: 503, error: SETUP_REQUIRED_MESSAGE };
    return { type: "redirect", to: SETUP_PATH };
  }

  if (mode.kind === "local") {
    // No Auth.js without its settings; the sign-in pages have nothing to do.
    if (isAuthApiPath(pathname)) return { type: "json", status: 404, error: "없는 주소입니다." };
    if (AUTH_PAGES.has(pathname)) return { type: "redirect", to: "/" };
    return NEXT;
  }

  // login
  if (isAuthApiPath(pathname)) return NEXT;
  if (pathname === SETUP_PATH) return { type: "redirect", to: "/" };
  if (pathname === LOGIN_PATH || pathname === DENIED_PATH) return NEXT;
  if (signedIn) return NEXT;
  if (isApiPath(pathname)) return { type: "json", status: 401, error: LOGIN_REQUIRED_MESSAGE };
  const back = safeNextPath(`${pathname}${search}`);
  return {
    type: "redirect",
    to: back === "/" ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(back)}`,
  };
}
