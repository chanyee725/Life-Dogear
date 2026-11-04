import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DENIED_PATH, LOGIN_PATH } from "@/lib/auth/access";
import { isAllowedEmail, parseAllowedEmails } from "@/lib/auth/allowlist";

/**
 * Auth.js (next-auth v5): Google sign-in, JWT session cookie, no database adapter.
 * Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment; it is
 * only used when all auth settings are present (see `resolveAuthMode`).
 *
 * Only addresses in ALLOWED_EMAILS get a session; others land on the refusal page.
 * The token keeps the email alone (no name or picture). Nothing here is logged.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // The middleware's Host check (ALLOWED_HOSTS) already pins which hosts reach this.
  trustHost: true,
  pages: { signIn: LOGIN_PATH, error: LOGIN_PATH },
  logger: {
    // Auth.js errors can carry request details; keep only the error name.
    error: (error) => console.error("[auth]", error.name),
    warn: () => {},
    debug: () => {},
  },
  callbacks: {
    signIn({ profile }) {
      const verified = profile?.email_verified === true;
      const allowed = isAllowedEmail(
        profile?.email,
        parseAllowedEmails(process.env.ALLOWED_EMAILS),
      );
      return verified && allowed ? true : DENIED_PATH;
    },
    jwt({ token }) {
      return { sub: token.sub, email: token.email };
    },
    session({ session, token }) {
      return {
        ...session,
        user: { email: typeof token.email === "string" ? token.email : "" },
      } as typeof session;
    },
  },
});

/** Whether a session belongs to an address that is (still) in ALLOWED_EMAILS. */
export function isAllowedSession(
  session: { user?: { email?: string | null } | null } | null | undefined,
): boolean {
  return isAllowedEmail(session?.user?.email, parseAllowedEmails(process.env.ALLOWED_EMAILS));
}
