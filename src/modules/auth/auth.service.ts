import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { signToken } from "../../lib/jwt.js";
import type { UserRole } from "../../lib/types.js";
import type { LoginInput } from "./auth.schema.js";

// Data user yang dikembalikan API sekaligus yang ditaruh di context request
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

// Cek email + password. Kalau lolos, kembalikan JWT beserta data user-nya.
export async function login(input: LoginInput): Promise<{ token: string; user: AuthUser }> {
  const [row] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  // Email tidak ketemu atau password tidak cocok dibalas error yang sama persis,
  // biar tidak ketahuan email mana yang sebenarnya terdaftar.
  const passwordOk = row ? await bcrypt.compare(input.password, row.passwordHash) : false;
  if (!row || !passwordOk) {
    throw AppError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const token = await signToken({ id: row.id, role: row.role });
  return { token, user: toAuthUser(row) };
}

// Dipakai middleware authenticate untuk memuat ulang user dari id yang ada di token.
export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toAuthUser(row) : null;
}
