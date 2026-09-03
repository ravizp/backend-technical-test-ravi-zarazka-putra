import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { verifyToken } from "../../lib/jwt.js";
import type { UserRole } from "../../lib/types.js";
import { findAuthUserById, type AuthUser } from "./auth.service.js";

//Hono context variables set
export type AuthEnv = { Variables: { user: AuthUser } };

// Middleware - authenticate
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

// Type guard for currentUser
export function currentUser(c: Context<AuthEnv>): AuthUser {
  return c.get("user");
}

// Middleware - requireRole
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

// Middleware - protect
export function protect(...allowed: UserRole[]): MiddlewareHandler<AuthEnv>[] {
  return allowed.length > 0 ? [authenticate, requireRole(...allowed)] : [authenticate];
}
