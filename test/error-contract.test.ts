import { createRoute, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/error-handler-http-status-codes.js";
import { notFound, onError } from "../src/middleware/error-handler.js";
import { createRouter } from "../src/openapi.js";

function makeApp() {
  const app = createRouter();

  app.openapi(
    createRoute({
      method: "post",
      path: "/echo",
      request: { body: { content: { "application/json": { schema: z.object({ name: z.string() }) } } } },
      responses: { 200: { description: "ok" } },
    }),
    (c) => c.json(c.req.valid("json")),
  );

  app.get("/boom-app", () => {
    throw AppError.conflict("Nope", "SOME_CONFLICT");
  });
  app.get("/boom-unknown", () => {
    throw new Error("kaboom");
  });

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

/** Every error response must be exactly `{ error: { code: string, message: string, details? } }`. */
function expectEnvelope(
  body: unknown,
): asserts body is { error: { code: string; message: string; details?: unknown } } {
  expect(body).toHaveProperty("error");
  const { error } = body as { error: Record<string, unknown> };
  expect(typeof error.code).toBe("string");
  expect(typeof error.message).toBe("string");
  expect(Object.keys(error).every((k) => ["code", "message", "details"].includes(k))).toBe(true);
}

describe("error contract", () => {
  it("unknown route -> 404 ROUTE_NOT_FOUND", async () => {
    const res = await makeApp().request("/missing");
    expect(res.status).toBe(404);
    const body = await res.json();
    expectEnvelope(body);
    expect(body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("schema validation failure -> 422 VALIDATION_ERROR with details[]", async () => {
    const res = await makeApp().request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: 123 }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expectEnvelope(body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("malformed JSON body -> 400 BAD_REQUEST", async () => {
    const res = await makeApp().request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expectEnvelope(body);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("AppError propagates its status + code", async () => {
    const res = await makeApp().request("/boom-app");
    expect(res.status).toBe(409);
    const body = await res.json();
    expectEnvelope(body);
    expect(body.error.code).toBe("SOME_CONFLICT");
  });

  it("unexpected error -> 500 INTERNAL_SERVER_ERROR, no leak", async () => {
    const res = await makeApp().request("/boom-unknown");
    expect(res.status).toBe(500);
    const body = await res.json();
    expectEnvelope(body);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).not.toContain("kaboom");
  });
});
