import { z } from "@hono/zod-openapi";
import { USER_ROLES } from "../../lib/types.js";

export const loginBodySchema = z
  .object({
    email: z.email().openapi({ example: "user1@example.com" }),
    password: z.string().min(1, "password is required").openapi({ example: "123123" }),
  })
  .openapi("LoginBody");

export const authUserSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.enum(USER_ROLES),
  })
  .openapi("AuthUser");

export const loginResponseSchema = z
  .object({
    token: z.string(),
    user: authUserSchema,
  })
  .openapi("LoginResponse");

export type LoginInput = z.infer<typeof loginBodySchema>;
