/** DB connection config, usable from CLI tools (drizzle-kit, seed) and the app. */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

export const LOCAL_DATABASE_URL = "file:./data/local.db";

export type DbConfig = { url: string; authToken?: string };

/** `DATABASE_URL` selects Turso; without it the app uses a local SQLite file. */
export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const url = env.DATABASE_URL?.trim();
  if (!url) return { url: LOCAL_DATABASE_URL };
  return { url, authToken: env.DATABASE_AUTH_TOKEN?.trim() || undefined };
}

/** Creates the parent directory of a `file:` database so first runs just work. */
export function ensureLocalDir(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (path && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
}

export function createDb(config: DbConfig = resolveDbConfig()): Db {
  ensureLocalDir(config.url);
  const client = createClient(config);
  return drizzle(client, { schema });
}
