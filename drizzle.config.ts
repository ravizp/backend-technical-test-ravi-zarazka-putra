import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI: it only needs DB credentials, so it reads
// the PG_* vars directly instead of loading the full app env (which also
// validates JWT config that migrations don't care about).
try {
  process.loadEnvFile();
} catch {
  // no .env — fall back to ambient environment
}

const {
  PG_HOSTNAME = "localhost",
  PG_PORT = "5432",
  PG_USERNAME = "postgres",
  PG_PASSWORD = "postgres",
  PG_DATABASE = "inventory_procurement",
} = process.env;

const url = `postgres://${encodeURIComponent(PG_USERNAME)}:${encodeURIComponent(
  PG_PASSWORD,
)}@${PG_HOSTNAME}:${PG_PORT}/${PG_DATABASE}`;

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
