import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers/set-columns.js";
import { products } from "./create-table-products.js";
import { purchaseOrders } from "./create-table-purchase-orders.js";

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: primaryId,
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    orderedQuantity: integer("ordered_quantity").notNull(),
    receivedQuantity: integer("received_quantity").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "po_items_po_fk",
      columns: [t.purchaseOrderId],
      foreignColumns: [purchaseOrders.id],
    }).onDelete("cascade"),
    unique("purchase_order_items_po_product_unique").on(t.purchaseOrderId, t.productId),
    check("purchase_order_items_ordered_qty_check", sql`${t.orderedQuantity} > 0`),
    check("purchase_order_items_received_qty_check", sql`${t.receivedQuantity} >= 0`),
    check(
      "purchase_order_items_received_lte_ordered_check",
      sql`${t.receivedQuantity} <= ${t.orderedQuantity}`,
    ),
    index("purchase_order_items_po_idx").on(t.purchaseOrderId),
  ],
);

export type PurchaseOrderItemRow = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItemRow = typeof purchaseOrderItems.$inferInsert;
