import { z } from "@hono/zod-openapi";
import { PURCHASE_ORDER_STATUSES } from "../../lib/types.js";

//body request
export const createGoodsReceiptSchema = z
  .object({
    purchaseOrderId: z.uuid(),
    receivedAt: z.iso.datetime().optional().openapi({ example: "2026-09-05T08:00:00.000Z" }),
    items: z
      .array(
        z.object({
          purchaseOrderItemId: z.uuid(),
          receivedQuantity: z.number().int().positive().openapi({ example: 60 }),
        }),
      )
      .openapi({ description: "Lines being received; the same PO item may repeat and will be summed" }),
  })
  .openapi("CreateGoodsReceipt");

//bentuk response
export const goodsReceiptItemSchema = z
  .object({
    id: z.uuid(),
    purchaseOrderItemId: z.uuid(),
    productId: z.uuid(),
    productSku: z.string(),
    productName: z.string(),
    receivedQuantity: z.number().int(),
  })
  .openapi("GoodsReceiptItem");

export const goodsReceiptSchema = z
  .object({
    id: z.uuid(),
    grNumber: z.string(),
    purchaseOrderId: z.uuid(),
    receivedBy: z.uuid(),
    receivedAt: z.string(),
    items: z.array(goodsReceiptItemSchema),
    purchaseOrder: z.object({ id: z.uuid(), status: z.enum(PURCHASE_ORDER_STATUSES) }),
    createdAt: z.string(),
  })
  .openapi("GoodsReceipt");

// Versi ringkas buat list: header GR saja, tanpa item dan tanpa status PO.
export const goodsReceiptSummarySchema = goodsReceiptSchema
  .omit({ items: true, purchaseOrder: true })
  .openapi("GoodsReceiptSummary");

export const goodsReceiptListSchema = z
  .object({ data: z.array(goodsReceiptSummarySchema) })
  .openapi("GoodsReceiptList");

export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
