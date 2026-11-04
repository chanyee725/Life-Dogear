/**
 * DNS-rebinding guard: the app only answers requests addressed to this machine.
 * A rebinding page reaches 127.0.0.1 but its Host header still names the attacker's
 * domain, so checking Host is enough for a local, unauthenticated app.
 */

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PORT_RE = /^\d{1,5}$/;

/** Splits `host[:port]`, keeping IPv6 brackets. Returns null when malformed. */
function splitHost(host: string): { hostname: string; port: string | null } | null {
  const m = /^(\[[0-9a-f:.]+\]|[^:[\]]+)(?::(.*))?$/i.exec(host);
  if (!m) return null;
  const port = m[2] ?? null;
  if (port !== null && !PORT_RE.test(port)) return null;
  return { hostname: m[1].toLowerCase(), port };
}

/** `ALLOWED_HOSTS` → lower-cased entries (`name` = any port, `name:port` = exact). */
export function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether `host[:port]` names this machine (localhost, 127.0.0.1, [::1]). */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const parsed = splitHost(host.trim());
  return parsed !== null && LOCAL_HOSTNAMES.has(parsed.hostname);
}

export function isAllowedHost(host: string | null | undefined, extra: readonly string[] = []) {
  if (!host) return false;
  const parsed = splitHost(host.trim());
  if (!parsed) return false;
  if (LOCAL_HOSTNAMES.has(parsed.hostname)) return true;
  const full = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  return extra.includes(full) || extra.includes(parsed.hostname);
}

export const FORBIDDEN_HOST_MESSAGE =
  "허용되지 않은 주소입니다. 이 앱은 이 컴퓨터에서 localhost 또는 127.0.0.1로만 열 수 있습니다.";
