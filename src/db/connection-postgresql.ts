import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl, env } from "../config/env.js";
import * as schema from "./schema/index.js";

// Initialize PostgreSQL client and Drizzle ORM
export const sql = postgres(databaseUrl, {
  max: env.NODE_ENV === "test" ? 1 : 10,
});

export const db = drizzle(sql, { schema, casing: "snake_case" });

export type Database = typeof db;

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
