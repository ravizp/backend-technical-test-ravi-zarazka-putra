import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { verifyToken } from "../../lib/jwt.js";
import type { UserRole } from "../../lib/types.js";
import { findAuthUserById, type AuthUser } from "./auth.service.js";

// user hasil login ditaruh di context Hono, biar handler tinggal ambil lewat currentUser()
export type AuthEnv = { Variables: { user: AuthUser } };

// Baca header Authorization, verifikasi JWT-nya, lalu muat user-nya ke context.
// Kalau ada yang tidak beres di salah satu langkah, langsung tolak 401.
export const authenticate: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    throw AppError.unauthorized("Missing or malformed Authorization header");
  }

  const token = header.slice(7).trim();
  let userId: string;
  try {
    ({ sub: userId } = await verifyToken(token));
  } catch {
    throw AppError.unauthorized("Invalid or expired token");
  }

  const user = await findAuthUserById(userId);
  if (!user) {
    throw AppError.unauthorized("User no longer exists");
  }

  c.set("user", user);
  await next();
};

// Ambil user yang sedang login. Baru aman dipakai setelah authenticate jalan.
export function currentUser(c: Context<AuthEnv>): AuthUser {
  return c.get("user");
}

// Batasi akses ke role tertentu. Selalu dipasang sesudah authenticate.
export function requireRole(...allowed: UserRole[]): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      throw AppError.unauthorized("Authentication required");
    }
    if (!allowed.includes(user.role)) {
      throw AppError.forbidden(`This action requires role: ${allowed.join(" or ")}`);
    }
    await next();
  };
}

// Yang dipakai di route. protect() = cukup wajib login;
// protect("APPROVER") = wajib login sekaligus role-nya harus cocok.
export function protect(...allowed: UserRole[]): MiddlewareHandler<AuthEnv>[] {
  return allowed.length > 0 ? [authenticate, requireRole(...allowed)] : [authenticate];
}
