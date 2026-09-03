import { timestamp, uuid } from "drizzle-orm/pg-core";

// uuid primary key
export const primaryId = uuid("id").primaryKey().defaultRandom();

// created_at and updated_at timestamps
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// created_at only
export const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};
