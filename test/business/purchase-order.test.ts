import { beforeEach, describe, expect, it } from "vitest";
import { api, type ErrorBody } from "../helpers/api.js";
import { truncateAll } from "../helpers/db.js";
import { seedBasics, type Fixtures } from "../helpers/fixtures.js";

describe("Purchase Order business rules", () => {
  let f: Fixtures;
  beforeEach(async () => {
    await truncateAll();
    f = await seedBasics();
  });

  //local flow helpers
  async function draftPr() {
    const res = await api<{ id: string }>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id, items: [{ productId: f.productA.id, quantity: 100 }] },
    });
    return res.body.id;
  }

  async function approvedPr() {
    const id = await draftPr();
    await api("POST", `/api/purchase-requests/${id}/submit`, { token: f.userToken });
    await api("POST", `/api/purchase-requests/${id}/approve`, { token: f.approverToken });
    return id;
  }

  function createPo<T = Record<string, unknown>>(purchaseRequestId: string) {
    return api<T>("POST", "/api/purchase-orders", {
      token: f.userToken,
      body: { purchaseRequestId, supplierId: f.supplier.id },
    });
  }

  // --- Point 3: a PO can only be created from an APPROVED PR ---

  it("rejects creating a Purchase Order from a DRAFT Purchase Request", async () => {
    const prId = await draftPr();

    const res = await createPo<ErrorBody>(prId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_NOT_APPROVED");
  });

  it("rejects creating a Purchase Order from a SUBMITTED (not yet approved) Purchase Request", async () => {
    const prId = await draftPr();
    await api("POST", `/api/purchase-requests/${prId}/submit`, { token: f.userToken });

    const res = await createPo<ErrorBody>(prId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_NOT_APPROVED");
  });

  it("creates a Purchase Order from an APPROVED PR (items copied, status DRAFT)", async () => {
    const prId = await approvedPr();

    const res = await api<{
      status: string;
      purchaseRequestId: string;
      warehouseId: string;
      items: { orderedQuantity: number; receivedQuantity: number }[];
    }>("POST", "/api/purchase-orders", {
      token: f.userToken,
      body: { purchaseRequestId: prId, supplierId: f.supplier.id },
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.purchaseRequestId).toBe(prId);
    expect(res.body.warehouseId).toBe(f.warehouse.id); // copied from the PR
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]?.orderedQuantity).toBe(100);
    expect(res.body.items[0]?.receivedQuantity).toBe(0);
  });
});
