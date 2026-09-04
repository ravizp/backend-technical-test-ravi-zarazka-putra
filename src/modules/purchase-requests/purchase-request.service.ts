import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import {
  products,
  purchaseRequestItems,
  purchaseRequests,
  warehouses,
} from "../../db/schema/index.js";
import { nextDocumentNumber } from "../../lib/document-number.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { limitOffset, paginated } from "../../lib/pagination.js";
import type { AuthUser } from "../auth/auth.service.js";
import type {
  AddItemInput,
  CreatePurchaseRequestInput,
  ListPurchaseRequestQuery,
  UpdateItemInput,
  UpdatePurchaseRequestInput,
} from "./purchase-request.schema.js";

type PrRow = typeof purchaseRequests.$inferSelect;
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Validasi yang dipakai bareng oleh create, ganti warehouse, dan submit.
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

// serialisasi: menggabungkan header PR dengan daftar item nya jadi bentuk response
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

// Bagian header PR saja, tanpa item.
function headerDto(pr: PrRow) {
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
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
  };
}

function serialize(pr: PrRow, items: Awaited<ReturnType<typeof itemsWithProduct>>) {
  return { ...headerDto(pr), items };
}

async function loadRow(id: string): Promise<PrRow> {
  const [row] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)).limit(1);
  if (!row) throw AppError.notFound("Purchase Request not found", "PURCHASE_REQUEST_NOT_FOUND");
  return row;
}

// Ambil PR by id apa adanya, tanpa cek kepemilikan. Dipakai internal sesudah aksi tulis.
export async function getPurchaseRequestById(id: string) {
  const row = await loadRow(id);
  return serialize(row, await itemsWithProduct(id));
}

// Versi yang lihat siapa yang minta: USER cuma boleh PR miliknya sendiri,
// PR orang lain sengaja dibalas 404 biar keberadaannya tidak bocor.
export async function getPurchaseRequestForViewer(id: string, viewer: AuthUser) {
  const row = await loadRow(id);
  if (viewer.role === "USER" && row.requestedBy !== viewer.id) {
    throw AppError.notFound("Purchase Request not found", "PURCHASE_REQUEST_NOT_FOUND");
  }
  return serialize(row, await itemsWithProduct(id));
}

// List PR. USER otomatis dipersempit ke miliknya; APPROVER lihat semua.
export async function listPurchaseRequests(query: ListPurchaseRequestQuery, viewer: AuthUser) {
  const filters = [];
  if (viewer.role === "USER") filters.push(eq(purchaseRequests.requestedBy, viewer.id));
  if (query.status) filters.push(eq(purchaseRequests.status, query.status));
  if (query.warehouseId) filters.push(eq(purchaseRequests.warehouseId, query.warehouseId));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(purchaseRequests).where(where);
  const { limit, offset } = limitOffset(query);
  const rows = await db
    .select()
    .from(purchaseRequests)
    .where(where)
    .orderBy(desc(purchaseRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db
        .select({ prId: purchaseRequestItems.purchaseRequestId, n: count() })
        .from(purchaseRequestItems)
        .where(inArray(purchaseRequestItems.purchaseRequestId, ids))
        .groupBy(purchaseRequestItems.purchaseRequestId)
    : [];
  const byPr = new Map(counts.map((c) => [c.prId, c.n]));

  const data = rows.map((r) => ({ ...headerDto(r), itemCount: byPr.get(r.id) ?? 0 }));
  return paginated(data, totalRow?.value ?? 0, query);
}

// Buat PR baru, selalu mulai dari DRAFT. items boleh langsung diisi atau ditambah belakangan.
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

// Ambil PR yang memang boleh diedit orang ini: harus pemiliknya, dan harus masih DRAFT.
async function loadEditableDraft(id: string, userId: string): Promise<PrRow> {
  const pr = await loadRow(id);
  if (pr.requestedBy !== userId) {
    throw AppError.forbidden("You can only edit your own Purchase Request");
  }
  if (pr.status !== "DRAFT") {
    throw AppError.conflict(
      "Only a DRAFT Purchase Request can be edited",
      "PURCHASE_REQUEST_NOT_EDITABLE",
    );
  }
  return pr;
}

// Cuma perbarui updatedAt PR-nya. Dipanggil sesudah item-nya berubah.
async function touch(exec: DbOrTx, id: string): Promise<void> {
  await exec
    .update(purchaseRequests)
    .set({ updatedAt: new Date() })
    .where(eq(purchaseRequests.id, id));
}

export async function updatePurchaseRequestWarehouse(
  id: string,
  userId: string,
  input: UpdatePurchaseRequestInput,
) {
  await loadEditableDraft(id, userId);
  await assertWarehouseUsable(input.warehouseId);
  await db
    .update(purchaseRequests)
    .set({ warehouseId: input.warehouseId, updatedAt: new Date() })
    .where(eq(purchaseRequests.id, id));
  return getPurchaseRequestById(id);
}

export async function addPurchaseRequestItem(id: string, userId: string, input: AddItemInput) {
  await loadEditableDraft(id, userId);
  await assertProductsUsable([input.productId]);

  const [dup] = await db
    .select({ id: purchaseRequestItems.id })
    .from(purchaseRequestItems)
    .where(
      and(
        eq(purchaseRequestItems.purchaseRequestId, id),
        eq(purchaseRequestItems.productId, input.productId),
      ),
    )
    .limit(1);
  if (dup) {
    throw AppError.unprocessable(
      "This product is already on the Purchase Request",
      "PURCHASE_REQUEST_DUPLICATE_PRODUCT",
    );
  }

  await db.transaction(async (tx) => {
    await tx.insert(purchaseRequestItems).values({
      purchaseRequestId: id,
      productId: input.productId,
      quantity: input.quantity,
    });
    await touch(tx, id);
  });
  return getPurchaseRequestById(id);
}

export async function updatePurchaseRequestItem(
  id: string,
  itemId: string,
  userId: string,
  input: UpdateItemInput,
) {
  await loadEditableDraft(id, userId);
  const [item] = await db
    .select({ id: purchaseRequestItems.id })
    .from(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.id, itemId), eq(purchaseRequestItems.purchaseRequestId, id)))
    .limit(1);
  if (!item) {
    throw AppError.notFound("Item not found on this Purchase Request", "PURCHASE_REQUEST_ITEM_NOT_FOUND");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(purchaseRequestItems)
      .set({ quantity: input.quantity, updatedAt: new Date() })
      .where(eq(purchaseRequestItems.id, itemId));
    await touch(tx, id);
  });
  return getPurchaseRequestById(id);
}

export async function removePurchaseRequestItem(id: string, itemId: string, userId: string) {
  await loadEditableDraft(id, userId);
  const deleted = await db
    .delete(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.id, itemId), eq(purchaseRequestItems.purchaseRequestId, id)))
    .returning({ id: purchaseRequestItems.id });
  if (deleted.length === 0) {
    throw AppError.notFound("Item not found on this Purchase Request", "PURCHASE_REQUEST_ITEM_NOT_FOUND");
  }
  await touch(db, id);
}

// submit: DRAFT -> SUBMITTED
export async function submitPurchaseRequest(id: string, userId: string) {
  const pr = await loadRow(id);
  if (pr.requestedBy !== userId) {
    throw AppError.forbidden("You can only submit your own Purchase Request");
  }
  if (pr.status !== "DRAFT") {
    throw AppError.conflict(
      `Cannot submit a Purchase Request in status ${pr.status}`,
      "PURCHASE_REQUEST_INVALID_TRANSITION",
    );
  }

  const items = await itemsWithProduct(id);
  if (items.length === 0) {
    throw AppError.unprocessable(
      "Cannot submit a Purchase Request with no items",
      "PURCHASE_REQUEST_EMPTY",
    );
  }
  // Cek ulang: bisa saja ada product yang dinonaktifkan setelah tadi dimasukkan ke PR.
  await assertProductsUsable(items.map((i) => i.productId));

  await db
    .update(purchaseRequests)
    .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(purchaseRequests.id, id));

  return getPurchaseRequestById(id);
}

// approve / reject: SUBMITTED -> APPROVED / REJECTED
async function loadSubmittedPr(id: string): Promise<PrRow> {
  const pr = await loadRow(id);
  if (pr.status !== "SUBMITTED") {
    throw AppError.conflict(
      `Only a SUBMITTED Purchase Request can be approved or rejected (current status: ${pr.status})`,
      "PURCHASE_REQUEST_NOT_SUBMITTED",
    );
  }
  return pr;
}

export async function approvePurchaseRequest(id: string, approverId: string) {
  await loadSubmittedPr(id);
  await db
    .update(purchaseRequests)
    .set({
      status: "APPROVED",
      approvedBy: approverId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(purchaseRequests.id, id));
  return getPurchaseRequestById(id);
}

export async function rejectPurchaseRequest(id: string, approverId: string, reason: string) {
  await loadSubmittedPr(id);
  await db
    .update(purchaseRequests)
    .set({
      status: "REJECTED",
      approvedBy: approverId,
      approvedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(purchaseRequests.id, id));
  return getPurchaseRequestById(id);
}

export {
  assertNoDuplicateProducts,
  assertProductsUsable,
  assertWarehouseUsable,
  itemsWithProduct,
  loadRow,
  serialize,
};
export type { PrRow };
