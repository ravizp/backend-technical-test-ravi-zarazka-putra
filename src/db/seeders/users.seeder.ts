import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { db } from "../connection-postgresql.js";
import { users } from "../schema/index.js";
import type { UserRole } from "../../lib/types.js";

/** Shared password for every seeded account. Documented in the README. */
export const SEED_PASSWORD = "123123";

const SEED_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: "User 1", email: "user1@example.com", role: "USER" },
  { name: "User 2", email: "user2@example.com", role: "USER" },
  { name: "User 3", email: "user3@example.com", role: "USER" },
  { name: "Approver 1", email: "approver1@example.com", role: "APPROVER" },
  { name: "Approver 2", email: "approver2@example.com", role: "APPROVER" },
  { name: "Approver 3", email: "approver3@example.com", role: "APPROVER" }
];

// seedUsers inserts a set of users into the database.
export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, env.BCRYPT_ROUNDS);

  const inserted = await db
    .insert(users)
    .values(SEED_USERS.map((u) => ({ ...u, passwordHash })))
    .onConflictDoNothing({ target: users.email })
    .returning({ email: users.email });

  console.info(
    `[seed:users] inserted ${inserted.length}, skipped ${SEED_USERS.length - inserted.length} (already existed)`,
  );
}
