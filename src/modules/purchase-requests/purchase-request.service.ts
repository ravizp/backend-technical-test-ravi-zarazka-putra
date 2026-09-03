import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import {
  products,
  purchaseRequestItems,
  purchaseRequests,
  warehouses,
} from "../../db/schema/index.js";
import { nextDocumentNumber } from "../../lib/document-number.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import type { CreatePurchaseRequestInput } from "./purchase-request.schema.js";

type PrRow = typeof purchaseRequests.$inferSelect;

// shared validation
async function assertWarehouseUsable(warehouseId: string): Promise<void> {
  const [w] = await db
    .select({ isActive: warehouses.isActive })
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .limit(1);
  if (!w) throw AppError.unprocessable("Warehouse not found", "WAREHOUSE_NOT_FOUND");
  if (!w.isActive) throw AppError.unprocessable("Warehouse is inactive", "WAREHOUSE_INACTIVE");
}

async function assertProductsUsable(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const rows = await db
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(inArray(products.id, productIds));

  const found = new Map(rows.map((r) => [r.id, r.isActive]));
  for (const id of productIds) {
    if (!found.has(id)) {
      throw AppError.unprocessable(`Product ${id} not found`, "PRODUCT_NOT_FOUND");
    }
    if (!found.get(id)) {
      throw AppError.unprocessable(`Product ${id} is inactive`, "PRODUCT_INACTIVE");
    }
  }
}

function assertNoDuplicateProducts(items: { productId: string }[]): void {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.productId)) {
      throw AppError.unprocessable(
        "A product may appear only once per purchase request",
        "PURCHASE_REQUEST_DUPLICATE_PRODUCT",
      );
    }
    seen.add(it.productId);
  }
}

//serialisation
async function itemsWithProduct(purchaseRequestId: string) {
  const rows = await db
    .select({
      id: purchaseRequestItems.id,
      productId: purchaseRequestItems.productId,
      productSku: products.sku,
      productName: products.name,
      quantity: purchaseRequestItems.quantity,
    })
    .from(purchaseRequestItems)
    .innerJoin(products, eq(products.id, purchaseRequestItems.productId))
    .where(eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId))
    .orderBy(purchaseRequestItems.createdAt);
  return rows;
}

function serialize(pr: PrRow, items: Awaited<ReturnType<typeof itemsWithProduct>>) {
  return {
    id: pr.id,
    requestNumber: pr.requestNumber,
    warehouseId: pr.warehouseId,
    requestedBy: pr.requestedBy,
    status: pr.status,
    approvedBy: pr.approvedBy,
    approvedAt: pr.approvedAt?.toISOString() ?? null,
    rejectionReason: pr.rejectionReason,
    submittedAt: pr.submittedAt?.toISOString() ?? null,
    items,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
  };
}

async function loadRow(id: string): Promise<PrRow> {
  const [row] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)).limit(1);
  if (!row) throw AppError.notFound("Purchase Request not found", "PURCHASE_REQUEST_NOT_FOUND");
  return row;
}

export async function getPurchaseRequestById(id: string) {
  const row = await loadRow(id);
  return serialize(row, await itemsWithProduct(id));
}

//create purchase request
export async function createPurchaseRequest(input: CreatePurchaseRequestInput, requestedBy: string) {
  const items = input.items ?? [];
  assertNoDuplicateProducts(items);
  await assertWarehouseUsable(input.warehouseId);
  await assertProductsUsable(items.map((i) => i.productId));

  const id = await db.transaction(async (tx) => {
    const requestNumber = await nextDocumentNumber(tx, "PR");
    const [pr] = await tx
      .insert(purchaseRequests)
      .values({ requestNumber, warehouseId: input.warehouseId, requestedBy, status: "DRAFT" })
      .returning({ id: purchaseRequests.id });
    if (!pr) throw AppError.internal();

    if (items.length > 0) {
      await tx.insert(purchaseRequestItems).values(
        items.map((i) => ({
          purchaseRequestId: pr.id,
          productId: i.productId,
          quantity: i.quantity,
        })),
      );
    }
    return pr.id;
  });

  return getPurchaseRequestById(id);
}

export { assertNoDuplicateProducts, assertProductsUsable, assertWarehouseUsable, itemsWithProduct, loadRow, serialize };
export type { PrRow };
