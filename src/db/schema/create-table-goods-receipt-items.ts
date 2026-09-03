import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { createdAtOnly, primaryId } from "./helpers/set-columns.js";
import { goodsReceipts } from "./create-table-goods-receipts.js";
import { purchaseOrderItems } from "./create-table-purchase-order-items.js";

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: primaryId,
    goodsReceiptId: uuid("goods_receipt_id").notNull(),
    purchaseOrderItemId: uuid("purchase_order_item_id").notNull(),
    receivedQuantity: integer("received_quantity").notNull(),
    ...createdAtOnly,
  },
  (t) => [
    foreignKey({
      name: "gr_items_gr_fk",
      columns: [t.goodsReceiptId],
      foreignColumns: [goodsReceipts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gr_items_po_item_fk",
      columns: [t.purchaseOrderItemId],
      foreignColumns: [purchaseOrderItems.id],
    }).onDelete("restrict"),
    check("goods_receipt_items_received_qty_check", sql`${t.receivedQuantity} > 0`),
    index("goods_receipt_items_gr_idx").on(t.goodsReceiptId),
    index("goods_receipt_items_po_item_idx").on(t.purchaseOrderItemId),
  ],
);

export type GoodsReceiptItemRow = typeof goodsReceiptItems.$inferSelect;
export type NewGoodsReceiptItemRow = typeof goodsReceiptItems.$inferInsert;
