/**
 * `ALLOWED_EMAILS`: comma-separated addresses that may sign in. Compared case-insensitively
 * after trimming. An empty list allows no one.
 */
export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedEmail(
  email: string | null | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && allowed.has(normalized);
}
