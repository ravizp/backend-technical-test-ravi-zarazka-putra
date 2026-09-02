import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("app skeleton", () => {
  it("GET /health returns ok", async () => {
    const app = createApp();

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("inventory-procurement-api");
  });

  it("unknown route returns the consistent error envelope", async () => {
    const app = createApp();

    const res = await app.request("/no-such-route");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(typeof body.error.message).toBe("string");
  });
});
