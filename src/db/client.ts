import "server-only";
import { createDb, type Db } from "./config";

// App-side database access. Server only: keeps credentials and the libSQL driver
// out of client bundles. CLI tools import "./config" instead.
export { createDb, ensureLocalDir, LOCAL_DATABASE_URL, resolveDbConfig } from "./config";
export type { Db, DbConfig } from "./config";

// Cached on globalThis so dev-server hot reloads reuse one connection.
const globalForDb = globalThis as unknown as { __researchBrainDb?: Db };

export function getDb(): Db {
  globalForDb.__researchBrainDb ??= createDb();
  return globalForDb.__researchBrainDb;
}

/** Test hook: route all repo calls to the given database (e.g. in-memory). */
export function setDb(db: Db): void {
  globalForDb.__researchBrainDb = db;
}
