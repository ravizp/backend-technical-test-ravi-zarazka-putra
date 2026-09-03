import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import { inventories, inventoryMovements, products, warehouses } from "../../db/schema/index.js";
import { limitOffset, paginated } from "../../lib/pagination.js";
import type { MovementQuery, StockQuery } from "./inventory.schema.js";

// Inventory stock levels, filterable by warehouse and/or product.
export async function getStock(query: StockQuery) {
  const filters = [];
  if (query.warehouseId) filters.push(eq(inventories.warehouseId, query.warehouseId));
  if (query.productId) filters.push(eq(inventories.productId, query.productId));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select({
      warehouseId: inventories.warehouseId,
      warehouseCode: warehouses.code,
      warehouseName: warehouses.name,
      productId: inventories.productId,
      productSku: products.sku,
      productName: products.name,
      quantity: inventories.quantity,
      updatedAt: inventories.updatedAt,
    })
    .from(inventories)
    .innerJoin(warehouses, eq(warehouses.id, inventories.warehouseId))
    .innerJoin(products, eq(products.id, inventories.productId))
    .where(where)
    .orderBy(warehouses.code, products.sku);

  return { data: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })) };
}

// Inventory movements, filterable by warehouse, product, and/or reference ID.
export async function listMovements(query: MovementQuery) {
  const filters = [];
  if (query.warehouseId) filters.push(eq(inventoryMovements.warehouseId, query.warehouseId));
  if (query.productId) filters.push(eq(inventoryMovements.productId, query.productId));
  if (query.referenceId) filters.push(eq(inventoryMovements.referenceId, query.referenceId));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(inventoryMovements)
    .where(where);

  const { limit, offset } = limitOffset(query);
  const rows = await db
    .select({
      id: inventoryMovements.id,
      warehouseId: inventoryMovements.warehouseId,
      warehouseCode: warehouses.code,
      productId: inventoryMovements.productId,
      productSku: products.sku,
      movementType: inventoryMovements.movementType,
      quantity: inventoryMovements.quantity,
      referenceType: inventoryMovements.referenceType,
      referenceId: inventoryMovements.referenceId,
      createdBy: inventoryMovements.createdBy,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(warehouses, eq(warehouses.id, inventoryMovements.warehouseId))
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .where(where)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(limit)
    .offset(offset);

  const data = rows.map((r) => ({
    ...r,
    // Resolved from the source document once Goods Receipt exists (Phase 7).
    referenceNumber: null as string | null,
    createdAt: r.createdAt.toISOString(),
  }));

  return paginated(data, totalRow?.value ?? 0, query);
}
