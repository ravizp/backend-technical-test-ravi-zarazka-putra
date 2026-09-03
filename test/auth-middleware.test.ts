import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onError } from "../src/middleware/error-handler.js";
import { signToken } from "../src/lib/jwt.js";
import { authenticate, requireRole } from "../src/modules/auth/auth.middleware.js";
import type * as AuthService from "../src/modules/auth/auth.service.js";

type AuthUser = AuthService.AuthUser;

// authenticate() loads the user from the DB — stub that out so these stay unit tests.
const { findAuthUserById } = vi.hoisted(() => ({
  findAuthUserById: vi.fn<(id: string) => Promise<AuthUser | null>>(),
}));
vi.mock("../src/modules/auth/auth.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  findAuthUserById,
}));

const demoUser: AuthUser = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Demo User",
  email: "user@example.com",
  role: "USER",
};
const demoApprover: AuthUser = { ...demoUser, id: "22222222-2222-2222-2222-222222222222", role: "APPROVER" };

function makeApp() {
  const app = new OpenAPIHono();
  app.get("/any", authenticate, (c) => c.json({ ok: true }));
  app.get("/approver-only", authenticate, requireRole("APPROVER"), (c) => c.json({ ok: true }));
  app.onError(onError);
  return app;
}

function withToken(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

describe("auth middleware", () => {
  beforeEach(() => findAuthUserById.mockReset());

  it("rejects a request with no token (401 UNAUTHORIZED)", async () => {
    const res = await makeApp().request("/any");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed token (401)", async () => {
    const res = await makeApp().request("/any", withToken("not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("rejects a valid token whose user no longer exists (401)", async () => {
    findAuthUserById.mockResolvedValue(null);
    const token = await signToken(demoUser);
    const res = await makeApp().request("/any", withToken(token));
    expect(res.status).toBe(401);
  });

  it("allows any authenticated user through protect()", async () => {
    findAuthUserById.mockResolvedValue(demoUser);
    const token = await signToken(demoUser);
    const res = await makeApp().request("/any", withToken(token));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("blocks a USER from an APPROVER-only route (403 FORBIDDEN)", async () => {
    findAuthUserById.mockResolvedValue(demoUser);
    const token = await signToken(demoUser);
    const res = await makeApp().request("/approver-only", withToken(token));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("allows an APPROVER through an APPROVER-only route (200)", async () => {
    findAuthUserById.mockResolvedValue(demoApprover);
    const token = await signToken(demoApprover);
    const res = await makeApp().request("/approver-only", withToken(token));
    expect(res.status).toBe(200);
  });
});
