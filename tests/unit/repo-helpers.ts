import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb, setDb } from "@/db/client";

/** Fresh in-memory database with all migrations applied, wired into the repo. */
export async function useFreshDb() {
  const db = createDb({ url: ":memory:" });
  await migrate(db, { migrationsFolder: "drizzle" });
  setDb(db);
  return db;
}
