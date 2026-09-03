import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { signToken } from "../../lib/jwt.js";
import type { UserRole } from "../../lib/types.js";
import type { LoginInput } from "./auth.schema.js";

/** The user shape returned by the API and stored on the request context. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/** Verify credentials and issue a JWT. */
export async function login(input: LoginInput): Promise<{ token: string; user: AuthUser }> {
  const [row] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  const passwordOk = row ? await bcrypt.compare(input.password, row.passwordHash) : false;
  if (!row || !passwordOk) {
    throw AppError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const token = await signToken({ id: row.id, role: row.role });
  return { token, user: toAuthUser(row) };
}

/** Load a user by id — used by the authenticate middleware. */
export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toAuthUser(row) : null;
}
