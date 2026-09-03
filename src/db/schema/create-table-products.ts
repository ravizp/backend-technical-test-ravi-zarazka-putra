import { boolean, pgTable, text, unique } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers/set-columns.js";

export const products = pgTable(
  "products",
  {
    id: primaryId,
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [unique("products_sku_unique").on(t.sku)],
);

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
