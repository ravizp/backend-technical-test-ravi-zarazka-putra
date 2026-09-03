import { sign, verify } from "hono/jwt";
import { env } from "../config/env.js";
import type { UserRole } from "./types.js";

export interface JwtPayload {
  sub: string; // user id
  role: UserRole;
  iat: number;
  exp: number;
}

// duration in seconds
function durationSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 86_400;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s") as "s" | "m" | "h" | "d";
  return amount * { s: 1, m: 60, h: 3_600, d: 86_400 }[unit];
}

const ALG = "HS256";

export async function signToken(user: { id: string; role: UserRole }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { sub: user.id, role: user.role, iat: now, exp: now + durationSeconds(env.JWT_EXPIRES_IN) },
    env.JWT_SECRET_KEY,
    ALG,
  );
}

// verifyToken
export async function verifyToken(token: string): Promise<JwtPayload> {
  return (await verify(token, env.JWT_SECRET_KEY, ALG)) as unknown as JwtPayload;
}
