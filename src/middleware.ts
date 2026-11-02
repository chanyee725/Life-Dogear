import { NextResponse, type NextRequest } from "next/server";
import { FORBIDDEN_HOST_MESSAGE, isAllowedHost, parseAllowedHosts } from "@/lib/host-guard";

// Rejects requests whose Host is not this machine (DNS rebinding). Extra hosts can be
// allowed with ALLOWED_HOSTS="name[:port],…".
export function middleware(request: NextRequest) {
  const allowed = isAllowedHost(
    request.headers.get("host"),
    parseAllowedHosts(process.env.ALLOWED_HOSTS),
  );
  if (allowed) return NextResponse.next();
  return new NextResponse(FORBIDDEN_HOST_MESSAGE, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

// Every path, static assets included.
export const config = { matcher: "/:path*" };
