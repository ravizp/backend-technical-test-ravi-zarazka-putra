import { beforeEach, describe, expect, it } from "vitest";
import { api, type ErrorBody } from "../helpers/api.js";
import { truncateAll } from "../helpers/db.js";
import { seedBasics, type Fixtures } from "../helpers/fixtures.js";

describe("Purchase Request business rules", () => {
  let f: Fixtures;
  beforeEach(async () => {
    await truncateAll();
    f = await seedBasics();
  });

  //Point 1: cannot submit a PR without items
  it("rejects submitting a Purchase Request that has no items", async () => {
    const created = await api<{ id: string }>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id },
    });
    expect(created.status).toBe(201);

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${created.body.id}/submit`, {
      token: f.userToken,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_EMPTY");
  });

  it("submits a Purchase Request that has items (DRAFT -> SUBMITTED)", async () => {
    const created = await api<{ id: string }>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id, items: [{ productId: f.productA.id, quantity: 10 }] },
    });

    const res = await api<{ status: string }>(
      "POST",
      `/api/purchase-requests/${created.body.id}/submit`,
      { token: f.userToken },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SUBMITTED");
  });
});
