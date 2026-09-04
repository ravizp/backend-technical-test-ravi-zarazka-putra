import { z } from "@hono/zod-openapi";
import { MOVEMENT_REFERENCE_TYPES, MOVEMENT_TYPES } from "../../lib/types.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../lib/pagination.js";

// Saldo stok: satu baris per pasangan warehouse + product, sudah di-join biar
// code/nama warehouse dan sku/nama product ikut terbawa.
export const inventoryStockSchema = z
  .object({
    warehouseId: z.uuid(),
    warehouseCode: z.string(),
    warehouseName: z.string(),
    productId: z.uuid(),
    productSku: z.string(),
    productName: z.string(),
    quantity: z.number().int(),
    updatedAt: z.string(),
  })
  .openapi("InventoryStock");

export const inventoryStockListSchema = z
  .object({ data: z.array(inventoryStockSchema) })
  .openapi("InventoryStockList");

export const stockQuerySchema = z.object({
  warehouseId: z.uuid().optional(),
  productId: z.uuid().optional(),
});

// Satu baris ledger: catatan tiap kali stok berubah, lengkap dengan dokumen asalnya
// (referenceType + referenceId, mis. GOODS_RECEIPT).
export const movementSchema = z
  .object({
    id: z.uuid(),
    warehouseId: z.uuid(),
    warehouseCode: z.string(),
    productId: z.uuid(),
    productSku: z.string(),
    movementType: z.enum(MOVEMENT_TYPES),
    quantity: z.number().int(),
    referenceType: z.enum(MOVEMENT_REFERENCE_TYPES),
    referenceId: z.uuid(),
    referenceNumber: z.string().nullable(),
    createdBy: z.uuid().nullable(),
    createdAt: z.string(),
  })
  .openapi("InventoryMovement");

export const movementListSchema = paginatedResponseSchema(movementSchema);

export const movementQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.uuid().optional(),
  productId: z.uuid().optional(),
  referenceId: z.uuid().optional(),
});

export type StockQuery = z.infer<typeof stockQuerySchema>;
export type MovementQuery = z.infer<typeof movementQuerySchema>;
