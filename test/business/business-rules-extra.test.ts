import { beforeEach, describe, expect, it } from "vitest";
import { api, type ErrorBody } from "../helpers-testing/api-request.js";
import { truncateAll } from "../helpers-testing/db-connection.js";
import { seedBasics, type Fixtures } from "../helpers-testing/fixtures-seeders.js";

describe("Extra business rules", () => {
  let f: Fixtures;
  beforeEach(async () => {
    await truncateAll();
    f = await seedBasics();
  });

  //DRAFT PR with productA x100
  async function draftPr() {
    const res = await api<{ id: string }>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id, items: [{ productId: f.productA.id, quantity: 100 }] },
    });
    return res.body.id;
  }

  async function submittedPr() {
    const id = await draftPr();
    await api("POST", `/api/purchase-requests/${id}/submit`, { token: f.userToken });
    return id;
  }

  async function approvedPr() {
    const id = await submittedPr();
    await api("POST", `/api/purchase-requests/${id}/approve`, { token: f.approverToken });
    return id;
  }

  function deactivate(resource: "products" | "suppliers" | "warehouses", id: string) {
    return api("PATCH", `/api/${resource}/${id}`, {
      token: f.userToken,
      body: { isActive: false },
    });
  }

  // condition: a USER cannot approve 
  it("forbids a USER from approving a Purchase Request", async () => {
    const id = await submittedPr();

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${id}/approve`, {
      token: f.userToken,
    });
    expect(res.status).toBe(403);
  });

  // condition: rejecting changes the status correctly
  it("rejects a SUBMITTED Purchase Request (SUBMITTED -> REJECTED)", async () => {
    const id = await submittedPr();

    const res = await api<{ status: string }>("POST", `/api/purchase-requests/${id}/reject`, {
      token: f.approverToken,
      body: { reason: "Budget not available" },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
  });

  it("refuses to reject a Purchase Request that is still DRAFT", async () => {
    const id = await draftPr();

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${id}/reject`, {
      token: f.approverToken,
      body: { reason: "too early" },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_NOT_SUBMITTED");
  });

  // condition: duplicate product on add item
  it("refuses to add a product that is already on the Purchase Request", async () => {
    const id = await draftPr(); // already has productA

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${id}/items`, {
      token: f.userToken,
      body: { productId: f.productA.id, quantity: 5 },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_DUPLICATE_PRODUCT");
  });

  // condition: inactive master data is refused by new transactions
  it("refuses to create a Purchase Request for an inactive warehouse", async () => {
    expect((await deactivate("warehouses", f.warehouse.id)).status).toBe(200);

    const res = await api<ErrorBody>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id, items: [{ productId: f.productA.id, quantity: 1 }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("WAREHOUSE_INACTIVE");
  });

  it("refuses to add an inactive product to a Purchase Request", async () => {
    const id = await draftPr();
    expect((await deactivate("products", f.productB.id)).status).toBe(200);

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${id}/items`, {
      token: f.userToken,
      body: { productId: f.productB.id, quantity: 5 },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PRODUCT_INACTIVE");
  });

  it("refuses to create a Purchase Order with an inactive supplier", async () => {
    const prId = await approvedPr();
    expect((await deactivate("suppliers", f.supplier.id)).status).toBe(200);

    const res = await api<ErrorBody>("POST", "/api/purchase-orders", {
      token: f.userToken,
      body: { purchaseRequestId: prId, supplierId: f.supplier.id },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SUPPLIER_INACTIVE");
  });
});
