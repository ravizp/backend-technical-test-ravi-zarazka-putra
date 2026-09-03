import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { products } from "./create-table-products.js";
import { primaryId, timestamps } from "./helpers/set-columns.js";
import { warehouses } from "./create-table-warehouses.js";

/** Current stock balance — exactly one row per (warehouse, product). */
export const inventories = pgTable(
  "inventories",
  {
    id: primaryId,
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("inventories_warehouse_product_unique").on(t.warehouseId, t.productId),
    check("inventories_quantity_check", sql`${t.quantity} >= 0`),
    index("inventories_product_idx").on(t.productId),
  ],
);

export type InventoryRow = typeof inventories.$inferSelect;
export type NewInventoryRow = typeof inventories.$inferInsert;
