import { defineConfig } from "drizzle-kit";
import { ensureLocalDir, resolveDbConfig } from "./src/db/config";
import { loadEnvIfPresent } from "./src/db/env";

loadEnvIfPresent();
const { url, authToken } = resolveDbConfig();
ensureLocalDir(url);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: { url, authToken },
});
