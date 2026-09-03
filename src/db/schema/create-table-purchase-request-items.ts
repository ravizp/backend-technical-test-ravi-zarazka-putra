import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { products } from "./create-table-products.js";
import { purchaseRequests } from "./create-table-purchase-requests.js";
import { primaryId, timestamps } from "./helpers/set-columns.js";

export const purchaseRequestItems = pgTable(
  "purchase_request_items",
  {
    id: primaryId,
    purchaseRequestId: uuid("purchase_request_id").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (t) => [
    // Explicit short name — the auto-generated one exceeds Postgres' 63-char limit.
    foreignKey({
      name: "pr_items_pr_fk",
      columns: [t.purchaseRequestId],
      foreignColumns: [purchaseRequests.id],
    }).onDelete("cascade"),
    unique("purchase_request_items_pr_product_unique").on(t.purchaseRequestId, t.productId),
    check("purchase_request_items_quantity_check", sql`${t.quantity} > 0`),
    index("purchase_request_items_pr_idx").on(t.purchaseRequestId),
  ],
);

export type PurchaseRequestItemRow = typeof purchaseRequestItems.$inferSelect;
export type NewPurchaseRequestItemRow = typeof purchaseRequestItems.$inferInsert;
