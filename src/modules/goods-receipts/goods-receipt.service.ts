import { eq, sql } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import {
  goodsReceiptItems,
  goodsReceipts,
  inventories,
  inventoryMovements,
  purchaseOrderItems,
  purchaseOrders,
} from "../../db/schema/index.js";
import { isCheckViolation } from "../../lib/db-errors.js";
import { nextDocumentNumber } from "../../lib/document-number.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import type { PurchaseOrderStatus } from "../../lib/types.js";
import type { CreateGoodsReceiptInput } from "./goods-receipt.schema.js";
import { getGoodsReceiptById } from "./goods-receipt.serialize.js";

// Read side re-exported so routes only import from the service.
export {
  getGoodsReceiptById,
  listGoodsReceiptsForPurchaseOrder,
} from "./goods-receipt.serialize.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Requested = Map<string, number>;

// Validation helpers
function computePoStatus(
  items: { orderedQuantity: number; receivedQuantity: number }[],
): PurchaseOrderStatus {
  if (items.every((i) => i.receivedQuantity >= i.orderedQuantity)) return "RECEIVED";
  return items.some((i) => i.receivedQuantity > 0) ? "PARTIALLY_RECEIVED" : "ORDERED";
}

// Merge duplicate requested
function mergeLines(items: CreateGoodsReceiptInput["items"]): Requested {
  const merged: Requested = new Map();
  for (const it of items) {
    merged.set(
      it.purchaseOrderItemId,
      (merged.get(it.purchaseOrderItemId) ?? 0) + it.receivedQuantity,
    );
  }
  return merged;
}

const RECEIVABLE_STATUSES: PurchaseOrderStatus[] = ["ORDERED", "PARTIALLY_RECEIVED"];

// Load Receivable PO
async function loadReceivablePo(purchaseOrderId: string) {
  const [po] = await db
    .select({
      id: purchaseOrders.id,
      status: purchaseOrders.status,
      warehouseId: purchaseOrders.warehouseId,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, purchaseOrderId))
    .limit(1);
  if (!po) throw AppError.notFound("Purchase Order not found", "PURCHASE_ORDER_NOT_FOUND");
  if (!RECEIVABLE_STATUSES.includes(po.status)) {
    throw AppError.conflict(
      `Cannot receive goods for a Purchase Order in status ${po.status}`,
      "PURCHASE_ORDER_NOT_RECEIVABLE",
    );
  }
  return po;
}

// Pre-check quantities
async function preCheckQuantities(poId: string, requested: Requested): Promise<void> {
  const rows = await db
    .select({
      id: purchaseOrderItems.id,
      orderedQuantity: purchaseOrderItems.orderedQuantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const [poItemId, qty] of requested) {
    const line = byId.get(poItemId);
    if (!line) {
      throw AppError.unprocessable(
        `Item ${poItemId} does not belong to this Purchase Order`,
        "GOODS_RECEIPT_INVALID_ITEM",
      );
    }
    if (line.receivedQuantity + qty > line.orderedQuantity) {
      throw AppError.unprocessable(
        `Receiving ${qty} would exceed the ordered quantity ` +
          `(ordered ${line.orderedQuantity}, already received ${line.receivedQuantity})`,
        "GOODS_RECEIPT_QUANTITY_EXCEEDED",
      );
    }
  }
}

// Lock the PO and its items, then revalidate the requested quantities
async function lockAndRevalidate(tx: Tx, poId: string, requested: Requested) {
  await tx
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .for("update");
  const locked = await tx
    .select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      orderedQuantity: purchaseOrderItems.orderedQuantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId))
    .for("update");
  const byId = new Map(locked.map((i) => [i.id, i]));

  for (const [poItemId, qty] of requested) {
    const line = byId.get(poItemId);
    if (!line || line.receivedQuantity + qty > line.orderedQuantity) {
      throw AppError.unprocessable(
        "Receiving would exceed the ordered quantity",
        "GOODS_RECEIPT_QUANTITY_EXCEEDED",
      );
    }
  }
  return byId;
}

//Step 1: insert the GR header + its item rows.
async function insertGoodsReceipt(
  tx: Tx,
  poId: string,
  requested: Requested,
  receivedBy: string,
  receivedAt: Date,
) {
  const grNumber = await nextDocumentNumber(tx, "GR");
  const [gr] = await tx
    .insert(goodsReceipts)
    .values({ grNumber, purchaseOrderId: poId, receivedBy, receivedAt })
    .returning({ id: goodsReceipts.id });
  if (!gr) throw AppError.internal();

  await tx.insert(goodsReceiptItems).values(
    [...requested.entries()].map(([purchaseOrderItemId, receivedQuantity]) => ({
      goodsReceiptId: gr.id,
      purchaseOrderItemId,
      receivedQuantity,
    })),
  );
  return gr;
}

// Step 2: add the received amounts onto each PO item.
async function bumpReceivedQuantities(tx: Tx, requested: Requested): Promise<void> {
  try {
    for (const [poItemId, qty] of requested) {
      await tx
        .update(purchaseOrderItems)
        .set({
          receivedQuantity: sql`${purchaseOrderItems.receivedQuantity} + ${qty}`,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrderItems.id, poItemId));
    }
  } catch (err) {
    // Last line of defence: the DB CHECK (received_quantity <= ordered_quantity).
    if (isCheckViolation(err, "purchase_order_items_received_lte_ordered_check")) {
      throw AppError.unprocessable(
        "Receiving would exceed the ordered quantity",
        "GOODS_RECEIPT_QUANTITY_EXCEEDED",
      );
    }
    throw err;
  }
}

// Step 3: recompute the PO's status from its items.
async function syncPurchaseOrderStatus(tx: Tx, poId: string): Promise<void> {
  const items = await tx
    .select({
      orderedQuantity: purchaseOrderItems.orderedQuantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  await tx
    .update(purchaseOrders)
    .set({ status: computePoStatus(items), updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId));
}

// Steps 4 + 5: per product, add to the warehouse balance and log one movement.
async function applyStockReceipt(
  tx: Tx,
  warehouseId: string,
  lockedById: Awaited<ReturnType<typeof lockAndRevalidate>>,
  requested: Requested,
  grId: string,
  userId: string,
): Promise<void> {
  for (const [poItemId, qty] of requested) {
    const line = lockedById.get(poItemId);
    if (!line) throw AppError.internal();
    const { productId } = line;

    // Step 4: upsert the (warehouse, product) balance.
    await tx
      .insert(inventories)
      .values({ warehouseId, productId, quantity: qty })
      .onConflictDoUpdate({
        target: [inventories.warehouseId, inventories.productId],
        set: { quantity: sql`${inventories.quantity} + ${qty}`, updatedAt: new Date() },
      });

    // Step 5: append one PURCHASE_RECEIPT movement referencing this GR.
    await tx.insert(inventoryMovements).values({
      warehouseId,
      productId,
      movementType: "PURCHASE_RECEIPT",
      quantity: qty,
      referenceType: "GOODS_RECEIPT",
      referenceId: grId,
      createdBy: userId,
    });
  }
}

// Create a Goods Receipt
export async function createGoodsReceipt(input: CreateGoodsReceiptInput, receivedBy: string) {
  if (input.items.length === 0) {
    throw AppError.unprocessable(
      "A Goods Receipt must have at least one item",
      "GOODS_RECEIPT_EMPTY",
    );
  }

  const requested = mergeLines(input.items);
  const po = await loadReceivablePo(input.purchaseOrderId);
  await preCheckQuantities(po.id, requested);

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  const grId = await db.transaction(async (tx) => {
    const lockedById = await lockAndRevalidate(tx, po.id, requested); // 0
    const gr = await insertGoodsReceipt(tx, po.id, requested, receivedBy, receivedAt); // 1
    await bumpReceivedQuantities(tx, requested); // 2
    await syncPurchaseOrderStatus(tx, po.id); // 3
    await applyStockReceipt(tx, po.warehouseId, lockedById, requested, gr.id, receivedBy); // 4 + 5
    return gr.id;
  });

  return getGoodsReceiptById(grId);
}
