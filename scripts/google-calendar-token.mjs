#!/usr/bin/env node
// One-time helper: gets a Google OAuth refresh token for Calendar writes (docs/DEPLOY.md 7).
// No dependencies. Uses a "Desktop app" OAuth client and a loopback redirect on 127.0.0.1.
//
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/google-calendar-token.mjs
//
// Prints the refresh token once. Put it in GOOGLE_OAUTH_REFRESH_TOKEN (Vercel / .env.local)
// and nowhere else. Nothing is written to disk.
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 5 * 60_000;

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in this shell first, e.g.\n" +
      "  GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/google-calendar-token.mjs",
  );
  process.exit(1);
}

const b64url = (buf) => buf.toString("base64url");
const state = b64url(randomBytes(16));
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier).digest());

const server = createServer();
const timer = setTimeout(() => finish(1, "Timed out waiting for the browser (5 min)."), TIMEOUT_MS);

function finish(code, message) {
  clearTimeout(timer);
  if (message) (code ? console.error : console.log)(message);
  server.close();
  process.exit(code);
}

function reply(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

server.on("request", async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/") return reply(res, 404, "Not found");
  if (url.searchParams.get("state") !== state) return reply(res, 400, "State mismatch.");
  const error = url.searchParams.get("error");
  if (error) {
    reply(res, 400, `Google returned: ${error}. You can close this tab.`);
    return finish(1, `Google returned: ${error}`);
  }
  const code = url.searchParams.get("code");
  if (!code) return reply(res, 400, "Missing code.");

  const { port } = server.address();
  let body;
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: `http://127.0.0.1:${port}`,
      }).toString(),
    });
    body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  } catch (e) {
    reply(res, 500, "Token exchange failed. See the terminal.");
    return finish(1, `Token exchange failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  if (!body.refresh_token) {
    reply(res, 500, "No refresh token returned. See the terminal.");
    return finish(
      1,
      "Google returned no refresh_token. Remove this app's access at\n" +
        "https://myaccount.google.com/permissions and run the script again.",
    );
  }
  reply(res, 200, "Done. You can close this tab and go back to the terminal.");
  finish(
    0,
    "\nGOOGLE_OAUTH_REFRESH_TOKEN (copy it into Vercel / .env.local only, then clear this terminal):\n\n" +
      `${body.refresh_token}\n`,
  );
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  const auth = new URL(AUTH_URL);
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `http://127.0.0.1:${port}`,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  console.log(`Open this address in a browser and allow access:\n\n${auth}\n`);
  console.log(`Waiting on http://127.0.0.1:${port} …`);
});
