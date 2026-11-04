import "server-only";
import { headers } from "next/headers";
import { auth, isAllowedSession } from "@/auth";
import { resolveAuthMode, type AuthMode } from "./mode";

/** Access mode for the current request (env + Host). */
export async function currentAuthMode(): Promise<AuthMode> {
  const requestHeaders = await headers();
  return resolveAuthMode(process.env, requestHeaders.get("host"));
}

/** Signed in with an allowed address (login mode only; false otherwise). */
export async function hasAllowedSession(): Promise<boolean> {
  return isAllowedSession(await auth());
}

/**
 * Whether this request may see the app's notes (sidebar counts, search, capture).
 * The middleware already blocks protected pages; this keeps the shell off the sign-in,
 * refusal and setup pages, which render in the same root layout.
 */
export async function canShowApp(): Promise<boolean> {
  const mode = await currentAuthMode();
  if (mode.kind === "local") return true;
  if (mode.kind === "setup") return false;
  return hasAllowedSession();
}
