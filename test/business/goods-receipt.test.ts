import { beforeEach, describe, expect, it } from "vitest";
import { api, type ErrorBody } from "../helpers-testing/api-request.js";
import { truncateAll } from "../helpers-testing/db-connection.js";
import { seedBasics, type Fixtures } from "../helpers-testing/fixtures-seeders.js";

describe("Goods Receipt business rules", () => {
  let f: Fixtures;
  beforeEach(async () => {
    await truncateAll();
    f = await seedBasics();
  });

  // Drive PR -> PO all the way to an ORDERED PO with a single line of quantity
  async function orderedPo(quantity = 100) {
    const pr = await api<{ id: string }>("POST", "/api/purchase-requests", {
      token: f.userToken,
      body: { warehouseId: f.warehouse.id, items: [{ productId: f.productA.id, quantity }] },
    });
    await api("POST", `/api/purchase-requests/${pr.body.id}/submit`, { token: f.userToken });
    await api("POST", `/api/purchase-requests/${pr.body.id}/approve`, { token: f.approverToken });

    const po = await api<{ id: string; items: { id: string; orderedQuantity: number }[] }>(
      "POST",
      "/api/purchase-orders",
      { token: f.userToken, body: { purchaseRequestId: pr.body.id, supplierId: f.supplier.id } },
    );
    await api("POST", `/api/purchase-orders/${po.body.id}/mark-ordered`, { token: f.userToken });

    const line = po.body.items[0];
    if (!line) throw new Error("expected the Purchase Order to have one item");
    return { poId: po.body.id, poItemId: line.id, orderedQuantity: line.orderedQuantity };
  }

  //Record a Goods Receipt of `qty` against a single PO item.
  function receive<T = Record<string, unknown>>(poId: string, poItemId: string, qty: number) {
    return api<T>("POST", "/api/goods-receipts", {
      token: f.userToken,
      body: { purchaseOrderId: poId, items: [{ purchaseOrderItemId: poItemId, receivedQuantity: qty }] },
    });
  }

  // condition cannot receive more than the ordered quantity
  it("rejects receiving more than the ordered quantity in a single Goods Receipt", async () => {
    const { poId, poItemId } = await orderedPo(100);

    const res = await receive<ErrorBody>(poId, poItemId, 150);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("GOODS_RECEIPT_QUANTITY_EXCEEDED");
  });

  it("rejects a cumulative received quantity that exceeds the ordered quantity", async () => {
    const { poId, poItemId } = await orderedPo(100);

    const first = await receive(poId, poItemId, 80);
    expect(first.status).toBe(201);

    const second = await receive<ErrorBody>(poId, poItemId, 30); // 80 + 30 = 110 > 100
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe("GOODS_RECEIPT_QUANTITY_EXCEEDED");
  });

  it("accepts a partial receipt that stays within the ordered quantity", async () => {
    const { poId, poItemId } = await orderedPo(100);

    const res = await receive<{ purchaseOrder: { status: string } }>(poId, poItemId, 60);
    expect(res.status).toBe(201);
    expect(res.body.purchaseOrder.status).toBe("PARTIALLY_RECEIVED");
  });
});
