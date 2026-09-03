import { sql } from "drizzle-orm";
import { check, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { UserRole } from "../../lib/types.js";
import { primaryId, timestamps } from "./helpers/set-columns.js";

export const users = pgTable(
  "users",
  {
    id: primaryId,
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<UserRole>().notNull(),
    ...timestamps,
  },
  (t) => [
    unique("users_email_unique").on(t.email),
    check("users_role_check", sql`${t.role} IN ('USER', 'APPROVER')`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
