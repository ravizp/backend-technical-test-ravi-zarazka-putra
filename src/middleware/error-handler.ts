import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { AppError } from "../lib/error-handler-http-status-codes.js";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Map a bare HTTP status to a stable error code from the catalogue. */
const STATUS_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
};

function send(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return c.json(body, status as ContentfulStatusCode);
}

/**
 * Single exit point for every error. Guarantees the response body is always
 * `{ error: { code, message, details? } }` (see docs/error-handling.md).
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return send(c, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return send(c, 422, "VALIDATION_ERROR", "Request validation failed", err.issues);
  }

  // Thrown by Hono internals — e.g. `c.req.json()` on a malformed body (400).
  if (err instanceof HTTPException) {
    return send(c, err.status, STATUS_CODE[err.status] ?? "HTTP_ERROR", err.message);
  }

  console.error("Unhandled error:", err);
  return send(c, 500, "INTERNAL_SERVER_ERROR", "Something went wrong");
}

/** Response for routes that don't exist. */
export function notFound(c: Context): Response {
  return send(c, 404, "ROUTE_NOT_FOUND", `No route for ${c.req.method} ${c.req.path}`);
}
