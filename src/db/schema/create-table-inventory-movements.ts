import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { MovementReferenceType, MovementType } from "../../lib/types.js";
import { products } from "./create-table-products.js";
import { createdAtOnly, primaryId } from "./helpers/set-columns.js";
import { users } from "./create-table-users.js";
import { warehouses } from "./create-table-warehouses.js";

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: primaryId,
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    movementType: text("movement_type").$type<MovementType>().notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: text("reference_type").$type<MovementReferenceType>().notNull(),
    referenceId: uuid("reference_id").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "restrict" }),
    ...createdAtOnly,
  },
  (t) => [
    check("inventory_movements_type_check", sql`${t.movementType} IN ('PURCHASE_RECEIPT')`),
    check("inventory_movements_quantity_check", sql`${t.quantity} <> 0`),
    index("inventory_movements_wh_product_idx").on(t.warehouseId, t.productId),
    index("inventory_movements_reference_idx").on(t.referenceType, t.referenceId),
  ],
);

export type InventoryMovementRow = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovementRow = typeof inventoryMovements.$inferInsert;
