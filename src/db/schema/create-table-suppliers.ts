import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./helpers/set-columns.js";

export const suppliers = pgTable(
  "suppliers",
  {
    id: primaryId,
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
);

export type SupplierRow = typeof suppliers.$inferSelect;
suppliers.$inferInsert;