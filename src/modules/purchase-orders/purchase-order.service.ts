import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import {
  products,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  suppliers,
} from "../../db/schema/index.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { nextDocumentNumber } from "../../lib/document-number.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { limitOffset, paginated } from "../../lib/pagination.js";
import type { CreatePurchaseOrderInput, ListPurchaseOrderQuery } from "./purchase-order.schema.js";

type PoRow = typeof purchaseOrders.$inferSelect;

//serialisasi
function headerDto(po: PoRow) {
  return {
    id: po.id,
    poNumber: po.poNumber,
    purchaseRequestId: po.purchaseRequestId,
    supplierId: po.supplierId,
    warehouseId: po.warehouseId,
    status: po.status,
    createdBy: po.createdBy,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
  };
}

async function itemsWithProduct(purchaseOrderId: string) {
  return db
    .select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      productSku: products.sku,
      productName: products.name,
      orderedQuantity: purchaseOrderItems.orderedQuantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
    .orderBy(purchaseOrderItems.createdAt);
}

async function loadRow(id: string): Promise<PoRow> {
  const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  if (!row) throw AppError.notFound("Purchase Order not found", "PURCHASE_ORDER_NOT_FOUND");
  return row;
}

export async function getPurchaseOrderById(id: string) {
  const row = await loadRow(id);
  return { ...headerDto(row), items: await itemsWithProduct(id) };
}

// List PO. Bisa difilter by status, supplier, dan/atau warehouse.
export async function listPurchaseOrders(query: ListPurchaseOrderQuery) {
  const filters = [];
  if (query.status) filters.push(eq(purchaseOrders.status, query.status));
  if (query.supplierId) filters.push(eq(purchaseOrders.supplierId, query.supplierId));
  if (query.warehouseId) filters.push(eq(purchaseOrders.warehouseId, query.warehouseId));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(purchaseOrders).where(where);
  const { limit, offset } = limitOffset(query);
  const rows = await db
    .select()
    .from(purchaseOrders)
    .where(where)
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db
        .select({ poId: purchaseOrderItems.purchaseOrderId, n: count() })
        .from(purchaseOrderItems)
        .where(inArray(purchaseOrderItems.purchaseOrderId, ids))
        .groupBy(purchaseOrderItems.purchaseOrderId)
    : [];
  const byPo = new Map(counts.map((c) => [c.poId, c.n]));

  const data = rows.map((r) => ({ ...headerDto(r), itemCount: byPo.get(r.id) ?? 0 }));
  return paginated(data, totalRow?.value ?? 0, query);
}

// Buat PO dari PR yang sudah APPROVED. Product + quantity + warehouse disalin dari PR,
// supplier ditentukan di request ini. PO baru selalu mulai dari DRAFT.
export async function createPurchaseOrder(input: CreatePurchaseOrderInput, createdBy: string) {
  const [pr] = await db
    .select({ status: purchaseRequests.status, warehouseId: purchaseRequests.warehouseId })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, input.purchaseRequestId))
    .limit(1);
  if (!pr) {
    throw AppError.notFound("Purchase Request not found", "PURCHASE_REQUEST_NOT_FOUND");
  }
  if (pr.status !== "APPROVED") {
    throw AppError.conflict(
      `Purchase Request must be APPROVED before a Purchase Order can be created (current status: ${pr.status})`,
      "PURCHASE_REQUEST_NOT_APPROVED",
    );
  }

  // Cek di aplikasi ini cuma biar pesan error-nya enak dibaca. Yang benar-benar
  // mencegah PO dobel dari satu PR adalah UNIQUE constraint di DB (lihat catch di bawah).
  const [existingPo] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.purchaseRequestId, input.purchaseRequestId))
    .limit(1);
  if (existingPo) {
    throw AppError.conflict(
      "This Purchase Request already has a Purchase Order",
      "PURCHASE_ORDER_ALREADY_EXISTS",
    );
  }

  const [supplier] = await db
    .select({ isActive: suppliers.isActive })
    .from(suppliers)
    .where(eq(suppliers.id, input.supplierId))
    .limit(1);
  if (!supplier) throw AppError.unprocessable("Supplier not found", "SUPPLIER_NOT_FOUND");
  if (!supplier.isActive) throw AppError.unprocessable("Supplier is inactive", "SUPPLIER_INACTIVE");

  const prItems = await db
    .select({
      productId: purchaseRequestItems.productId,
      quantity: purchaseRequestItems.quantity,
    })
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, input.purchaseRequestId));

  const id = await db.transaction(async (tx) => {
    const poNumber = await nextDocumentNumber(tx, "PO");
    let po;
    try {
      [po] = await tx
        .insert(purchaseOrders)
        .values({
          poNumber,
          purchaseRequestId: input.purchaseRequestId,
          supplierId: input.supplierId,
          warehouseId: pr.warehouseId,
          status: "DRAFT",
          createdBy,
        })
        .returning({ id: purchaseOrders.id });
    } catch (err) {
      if (isUniqueViolation(err, "purchase_orders_purchase_request_unique")) {
        throw AppError.conflict(
          "This Purchase Request already has a Purchase Order",
          "PURCHASE_ORDER_ALREADY_EXISTS",
        );
      }
      throw err;
    }
    if (!po) throw AppError.internal();

    if (prItems.length > 0) {
      await tx.insert(purchaseOrderItems).values(
        prItems.map((it) => ({
          purchaseOrderId: po.id,
          productId: it.productId,
          orderedQuantity: it.quantity,
          receivedQuantity: 0,
        })),
      );
    }
    return po.id;
  });

  return getPurchaseOrderById(id);
}

// mark as ordered: DRAFT -> ORDERED
export async function markPurchaseOrderAsOrdered(id: string) {
  const po = await loadRow(id);
  if (po.status !== "DRAFT") {
    throw AppError.conflict(
      `Only a DRAFT Purchase Order can be marked as ORDERED (current status: ${po.status})`,
      "PURCHASE_ORDER_INVALID_TRANSITION",
    );
  }
  await db
    .update(purchaseOrders)
    .set({ status: "ORDERED", updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id));
  return getPurchaseOrderById(id);
}

export { headerDto, itemsWithProduct, loadRow };
export type { PoRow };
