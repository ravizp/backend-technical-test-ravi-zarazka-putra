import { eq } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import {
  goodsReceiptItems,
  goodsReceipts,
  products,
  purchaseOrderItems,
  purchaseOrders,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import type { PurchaseOrderStatus } from "../../lib/types.js";

export type GrRow = typeof goodsReceipts.$inferSelect;

//serialisation
export async function itemsWithProduct(goodsReceiptId: string) {
  return db
    .select({
      id: goodsReceiptItems.id,
      purchaseOrderItemId: goodsReceiptItems.purchaseOrderItemId,
      productId: purchaseOrderItems.productId,
      productSku: products.sku,
      productName: products.name,
      receivedQuantity: goodsReceiptItems.receivedQuantity,
    })
    .from(goodsReceiptItems)
    .innerJoin(purchaseOrderItems, eq(purchaseOrderItems.id, goodsReceiptItems.purchaseOrderItemId))
    .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(eq(goodsReceiptItems.goodsReceiptId, goodsReceiptId))
    .orderBy(goodsReceiptItems.createdAt);
}

// Header DTO
export function headerDto(gr: GrRow) {
  return {
    id: gr.id,
    grNumber: gr.grNumber,
    purchaseOrderId: gr.purchaseOrderId,
    receivedBy: gr.receivedBy,
    receivedAt: gr.receivedAt.toISOString(),
    createdAt: gr.createdAt.toISOString(),
  };
}

export async function loadRow(id: string): Promise<GrRow> {
  const [row] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id)).limit(1);
  if (!row) throw AppError.notFound("Goods Receipt not found", "GOODS_RECEIPT_NOT_FOUND");
  return row;
}

// Get a GR by ID
export async function getGoodsReceiptById(id: string) {
  const gr = await loadRow(id);
  const [po] = await db
    .select({ id: purchaseOrders.id, status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, gr.purchaseOrderId))
    .limit(1);
  return {
    ...headerDto(gr),
    items: await itemsWithProduct(id),
    purchaseOrder: po ?? { id: gr.purchaseOrderId, status: "ORDERED" as PurchaseOrderStatus },
  };
}

// List all GRs for a given PO
export async function listGoodsReceiptsForPurchaseOrder(purchaseOrderId: string) {
  const rows = await db
    .select()
    .from(goodsReceipts)
    .where(eq(goodsReceipts.purchaseOrderId, purchaseOrderId))
    .orderBy(goodsReceipts.createdAt);
  return { data: rows.map(headerDto) };
}
