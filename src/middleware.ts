import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth, isAllowedSession } from "@/auth";
import { decideAccess, type Access } from "@/lib/auth/access";
import { resolveAuthMode, type AuthMode } from "@/lib/auth/mode";
import { FORBIDDEN_HOST_MESSAGE, isAllowedHost, parseAllowedHosts } from "@/lib/host-guard";

const NO_STORE = { "cache-control": "no-store" };

function apply(access: Access, request: NextRequest): NextResponse {
  if (access.type === "next") return NextResponse.next();
  if (access.type === "json") {
    return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE });
  }
  // Next normalizes 127.0.0.1 to `localhost` in middleware redirects (NextURL); sign-in on
  // this machine is therefore documented with http://localhost:3000 (docs/DEPLOY.md).
  const response = NextResponse.redirect(new URL(access.to, request.nextUrl), 307);
  response.headers.set("cache-control", "no-store");
  return response;
}

function gate(request: NextRequest, mode: AuthMode, signedIn: boolean): NextResponse {
  const { pathname, search } = request.nextUrl;
  return apply(decideAccess({ mode, pathname, search, signedIn }), request);
}

// Auth.js reads the session cookie and sets `request.auth`; used in login mode only.
// (Typed as Next middleware: the wrapper's overloads otherwise resolve to the route form.)
const withSession = auth((request) =>
  gate(request, { kind: "login" }, isAllowedSession(request.auth)),
) as unknown as (request: NextRequest, event?: NextFetchEvent) => Promise<Response>;

/**
 * 1. Host check: rejects requests whose Host is not this machine (DNS rebinding). Extra
 *    hosts can be allowed with ALLOWED_HOSTS="name[:port],…".
 * 2. Access check (`resolveAuthMode` + `decideAccess`): sign-in when configured, setup page
 *    when the app would otherwise be public, unchanged on this machine otherwise.
 * Same-origin checks on API routes stay in the routes.
 */
export async function middleware(request: NextRequest, event?: NextFetchEvent): Promise<Response> {
  const host = request.headers.get("host");
  if (!isAllowedHost(host, parseAllowedHosts(process.env.ALLOWED_HOSTS))) {
    return new NextResponse(FORBIDDEN_HOST_MESSAGE, {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8", ...NO_STORE },
    });
  }
  const mode = resolveAuthMode(process.env, host);
  if (mode.kind !== "login") return gate(request, mode, false);
  return withSession(request, event);
}

// Every path, static assets included: exclusions are decided in `decideAccess`.
export const config = { matcher: "/:path*" };
