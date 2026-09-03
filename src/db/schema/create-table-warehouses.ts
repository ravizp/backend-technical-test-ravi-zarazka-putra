import { boolean, pgTable, text, unique } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers/set-columns.js";

export const warehouses = pgTable(
  "warehouses",
  {
    id: primaryId,
    code: text("code").notNull(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [unique("warehouses_code_unique").on(t.code)],
);

export type WarehouseRow = typeof warehouses.$inferSelect;
export type NewWarehouseRow = typeof warehouses.$inferInsert;
