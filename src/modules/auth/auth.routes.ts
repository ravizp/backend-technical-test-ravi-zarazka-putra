import { createRoute } from "@hono/zod-openapi";
import { createRouter, errorResponse, jsonResponse } from "../../openapi.js";
import { currentUser, protect, type AuthEnv } from "./auth.middleware.js";
import { authUserSchema, loginBodySchema, loginResponseSchema } from "./auth.schema.js";
import { login } from "./auth.service.js";

export const authRoutes = createRouter<AuthEnv>();

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  summary: "Login with email and password",
  request: {
    body: { content: { "application/json": { schema: loginBodySchema } }, required: true },
  },
  responses: {
    200: jsonResponse(loginResponseSchema, "Access token and the authenticated user"),
    401: errorResponse("Invalid email or password"),
    422: errorResponse("Request body failed validation"),
  },
});

authRoutes.openapi(loginRoute, async (c) => {
  const result = await login(c.req.valid("json"));
  return c.json(result, 200);
});

const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Get the authenticated user",
  security: [{ bearerAuth: [] }],
  middleware: protect(),
  responses: {
    200: jsonResponse(authUserSchema, "The current user"),
    401: errorResponse("Missing, malformed, or expired token"),
  },
});

authRoutes.openapi(meRoute, (c) => c.json(currentUser(c), 200));
