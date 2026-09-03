import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { PurchaseRequestStatus } from "../../lib/types.js";
import { primaryId, timestamps } from "./helpers/set-columns.js";
import { users } from "./create-table-users.js";
import { warehouses } from "./create-table-warehouses.js";

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: primaryId,
    requestNumber: text("request_number").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status").$type<PurchaseRequestStatus>().notNull().default("DRAFT"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("purchase_requests_number_unique").on(t.requestNumber),
    check(
      "purchase_requests_status_check",
      sql`${t.status} IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')`,
    ),
    index("purchase_requests_status_idx").on(t.status),
    index("purchase_requests_warehouse_idx").on(t.warehouseId),
    index("purchase_requests_requested_by_idx").on(t.requestedBy),
  ],
);

export type PurchaseRequestRow = typeof purchaseRequests.$inferSelect;
export type NewPurchaseRequestRow = typeof purchaseRequests.$inferInsert;
