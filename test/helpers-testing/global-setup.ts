import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Global Setup Test
export async function setup() {
  const host = process.env.PG_HOSTNAME ?? "localhost";
  const port = Number(process.env.PG_PORT ?? 5433);
  const user = process.env.PG_USERNAME ?? "postgres";
  const password = process.env.PG_PASSWORD ?? "postgres";
  const database = process.env.PG_DATABASE ?? "inventory_procurement_test";

  // 1. ensure the test database exists (connect to the maintenance db)
  const admin = postgres({ host, port, user, password, database: "postgres", max: 1 });
  try {
    const rows = await admin<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${database}) AS exists
    `;
    if (!rows[0]?.exists) await admin.unsafe(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }

  // 2. reset + migrate the test database
  const client = postgres({ host, port, user, password, database, max: 1 });
  const db = drizzle(client);
  try {
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.unsafe("CREATE SCHEMA public");
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  } finally {
    await client.end();
  }
}
