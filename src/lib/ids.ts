/** Item ids: `crypto.randomUUID()` for user data, `seed-…` for sample data. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEED_RE = /^seed-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_ITEM_ID_LENGTH = 80;

export function isValidItemId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length <= MAX_ITEM_ID_LENGTH &&
    (UUID_RE.test(id) || SEED_RE.test(id))
  );
}
