import { z } from "@hono/zod-openapi";
import { PURCHASE_REQUEST_STATUSES } from "../../lib/types.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../lib/pagination.js";

// request bodies
export const prItemInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().openapi({ example: 100 }),
});

export const createPurchaseRequestSchema = z
  .object({
    warehouseId: z.uuid(),
    items: z.array(prItemInputSchema).optional(),
  })
  .openapi("CreatePurchaseRequest");

export const updatePurchaseRequestSchema = z
  .object({ warehouseId: z.uuid() })
  .openapi("UpdatePurchaseRequest");

export const addItemSchema = prItemInputSchema.openapi("AddPurchaseRequestItem");

export const updateItemSchema = z
  .object({ quantity: z.number().int().positive() })
  .openapi("UpdatePurchaseRequestItem");

//responses purchase request and items
export const purchaseRequestItemSchema = z
  .object({
    id: z.uuid(),
    productId: z.uuid(),
    productSku: z.string(),
    productName: z.string(),
    quantity: z.number().int(),
  })
  .openapi("PurchaseRequestItem");

export const purchaseRequestSchema = z
  .object({
    id: z.uuid(),
    requestNumber: z.string(),
    warehouseId: z.uuid(),
    requestedBy: z.uuid(),
    status: z.enum(PURCHASE_REQUEST_STATUSES),
    approvedBy: z.uuid().nullable(),
    approvedAt: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    submittedAt: z.string().nullable(),
    items: z.array(purchaseRequestItemSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("PurchaseRequest");

export const purchaseRequestListSchema = paginatedResponseSchema(
  purchaseRequestSchema.omit({ items: true }).extend({ itemCount: z.number().int() }),
).openapi("PurchaseRequestList");

export const listPurchaseRequestQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PURCHASE_REQUEST_STATUSES).optional(),
  warehouseId: z.uuid().optional(),
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListPurchaseRequestQuery = z.infer<typeof listPurchaseRequestQuerySchema>;
