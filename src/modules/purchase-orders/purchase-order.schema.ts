import { z } from "@hono/zod-openapi";
import { PURCHASE_ORDER_STATUSES } from "../../lib/types.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../lib/pagination.js";

//body request
export const createPurchaseOrderSchema = z
  .object({
    purchaseRequestId: z.uuid(),
    supplierId: z.uuid(),
  })
  .openapi("CreatePurchaseOrder");

//bentuk response
export const purchaseOrderItemSchema = z
  .object({
    id: z.uuid(),
    productId: z.uuid(),
    productSku: z.string(),
    productName: z.string(),
    orderedQuantity: z.number().int(),
    receivedQuantity: z.number().int(),
  })
  .openapi("PurchaseOrderItem");

export const purchaseOrderSchema = z
  .object({
    id: z.uuid(),
    poNumber: z.string(),
    purchaseRequestId: z.uuid(),
    supplierId: z.uuid(),
    warehouseId: z.uuid(),
    status: z.enum(PURCHASE_ORDER_STATUSES),
    createdBy: z.uuid(),
    items: z.array(purchaseOrderItemSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("PurchaseOrder");

export const purchaseOrderListSchema = paginatedResponseSchema(
  purchaseOrderSchema.omit({ items: true }).extend({ itemCount: z.number().int() }),
).openapi("PurchaseOrderList");

export const listPurchaseOrderQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
  supplierId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ListPurchaseOrderQuery = z.infer<typeof listPurchaseOrderQuerySchema>;
