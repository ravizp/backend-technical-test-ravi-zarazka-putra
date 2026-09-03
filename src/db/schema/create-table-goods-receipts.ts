import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAtOnly, primaryId } from "./helpers/set-columns.js";
import { purchaseOrders } from "./create-table-purchase-orders.js";
import { users } from "./create-table-users.js";

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: primaryId,
    grNumber: text("gr_number").notNull(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    ...createdAtOnly,
  },
  (t) => [
    unique("goods_receipts_number_unique").on(t.grNumber),
    index("goods_receipts_po_idx").on(t.purchaseOrderId),
  ],
);

export type GoodsReceiptRow = typeof goodsReceipts.$inferSelect;
export type NewGoodsReceiptRow = typeof goodsReceipts.$inferInsert;
