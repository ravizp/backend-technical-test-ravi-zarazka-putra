import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function onError(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return c.json(body, err.status as ContentfulStatusCode);
  }

  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.issues,
      },
    };
    return c.json(body, 422);
  }

  if (err instanceof HTTPException) {
    const body: ErrorBody = { error: { code: "HTTP_EXCEPTION", message: err.message } };
    return c.json(body, err.status);
  }

  console.error("Unhandled error:", err);
  const body: ErrorBody = {
    error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" },
  };
  return c.json(body, 500);
}

/** Response for routes that don't exist. */
export function notFound(c: Context): Response {
  const body: ErrorBody = {
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `No route for ${c.req.method} ${c.req.path}`,
    },
  };
  return c.json(body, 404);
}
