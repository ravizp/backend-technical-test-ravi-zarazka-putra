import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Env } from "hono";
import { AppError } from "./lib/error-handler-http-status-codes.js";

// OpenAPIHono with Error Handling
export function createRouter<E extends Env = Env>(): OpenAPIHono<E> {
  return new OpenAPIHono<E>({
    defaultHook: (result) => {
      if (!result.success) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Request validation failed",
          result.error.issues,
        );
      }
    },
  });
}

// OpenAPI Error Response Schema
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi("ErrorResponse");

// OpenAPI JSON Response Helper
export function jsonResponse<T extends z.ZodType>(schema: T, description: string) {
  return { content: { "application/json": { schema } }, description };
}

// OpenAPI Error Response Helper
export const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description);
