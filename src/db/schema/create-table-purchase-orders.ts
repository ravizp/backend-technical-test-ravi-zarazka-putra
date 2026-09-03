import { sql } from "drizzle-orm";
import { check, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import type { PurchaseOrderStatus } from "../../lib/types.js";
import { primaryId, timestamps } from "./helpers/set-columns.js";
import { purchaseRequests } from "./create-table-purchase-requests.js";
import { suppliers } from "./create-table-suppliers.js";
import { users } from "./create-table-users.js";
import { warehouses } from "./create-table-warehouses.js";

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: primaryId,
    poNumber: text("po_number").notNull(),
    purchaseRequestId: uuid("purchase_request_id")
      .notNull()
      .references(() => purchaseRequests.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: text("status").$type<PurchaseOrderStatus>().notNull().default("DRAFT"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    unique("purchase_orders_number_unique").on(t.poNumber),
    // One Purchase Request yields at most one Purchase Order.
    unique("purchase_orders_purchase_request_unique").on(t.purchaseRequestId),
    check(
      "purchase_orders_status_check",
      sql`${t.status} IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')`,
    ),
    index("purchase_orders_status_idx").on(t.status),
    index("purchase_orders_supplier_idx").on(t.supplierId),
    index("purchase_orders_warehouse_idx").on(t.warehouseId),
  ],
);

export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrderRow = typeof purchaseOrders.$inferInsert;
