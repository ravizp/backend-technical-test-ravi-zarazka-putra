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

  // condition: a Goods Receipt raises the warehouse stock balance
  function stockOf(productId: string) {
    return api<{ data: { quantity: number }[] }>(
      "GET",
      `/api/inventory?warehouseId=${f.warehouse.id}&productId=${productId}`,
      { token: f.userToken },
    );
  }

  it("adds the received quantity to the warehouse stock balance", async () => {
    const { poId, poItemId } = await orderedPo(100);

    const before = await stockOf(f.productA.id);
    expect(before.body.data).toHaveLength(0); // no stock before the receipt

    expect((await receive(poId, poItemId, 60)).status).toBe(201);
    const afterFirst = await stockOf(f.productA.id);
    expect(afterFirst.body.data[0]?.quantity).toBe(60);

    expect((await receive(poId, poItemId, 40)).status).toBe(201);
    const afterSecond = await stockOf(f.productA.id);
    expect(afterSecond.body.data[0]?.quantity).toBe(100); // 60 + 40, accumulated
  });

  it("logs one PURCHASE_RECEIPT movement for each receipt", async () => {
    const { poId, poItemId } = await orderedPo(100);
    await receive(poId, poItemId, 60);
    await receive(poId, poItemId, 40);

    const res = await api<{
      total: number;
      data: { movementType: string; referenceType: string; quantity: number }[];
    }>("GET", `/api/inventory-movements?warehouseId=${f.warehouse.id}&productId=${f.productA.id}`, {
      token: f.userToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    for (const m of res.body.data) {
      expect(m.movementType).toBe("PURCHASE_RECEIPT");
      expect(m.referenceType).toBe("GOODS_RECEIPT");
      expect(m.quantity).toBeGreaterThan(0);
    }
    const sum = res.body.data.reduce((acc, m) => acc + m.quantity, 0);
    expect(sum).toBe(100);
  });
});
