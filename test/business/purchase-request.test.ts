import { beforeEach, describe, expect, it } from "vitest";
import { api, type ErrorBody } from "../helpers-testing/api-request.js";
import { truncateAll } from "../helpers-testing/db-connection.js";
import { seedBasics, type Fixtures } from "../helpers-testing/fixtures-seeders.js";

describe("Purchase Request business rules", () => {
  let f: Fixtures;
  beforeEach(async () => {
    await truncateAll();
    f = await seedBasics();
  });

  // Create a DRAFT PR with one item and return its id.
  async function draftPr() {
    const res = await api<{ id: string }>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id, items: [{ productId: f.productA.id, quantity: 10 }] },
    });
    return res.body.id;
  }

  // Create a PR, submit it — returns a SUBMITTED PR id.
  async function submittedPr() {
    const id = await draftPr();
    await api("POST", `/api/purchase-requests/${id}/submit`, { token: f.userToken });
    return id;
  }

  // condition: cannot submit a PR without items
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

  // condition: can only approve a SUBMITTED PR
  it("rejects approving a Purchase Request that is still DRAFT", async () => {
    const id = await draftPr();

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${id}/approve`, {
      token: f.approverToken,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_NOT_SUBMITTED");
  });

  it("approves a SUBMITTED Purchase Request (SUBMITTED -> APPROVED)", async () => {
    const id = await submittedPr();

    const res = await api<{ status: string; approvedBy: string | null }>(
      "POST",
      `/api/purchase-requests/${id}/approve`,
      { token: f.approverToken },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.approvedBy).toBe(f.approver.id);
  });

  it("rejects approving a Purchase Request that is already APPROVED", async () => {
    const id = await submittedPr();
    await api("POST", `/api/purchase-requests/${id}/approve`, { token: f.approverToken });

    const res = await api<ErrorBody>("POST", `/api/purchase-requests/${id}/approve`, {
      token: f.approverToken,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PURCHASE_REQUEST_NOT_SUBMITTED");
  });
});
