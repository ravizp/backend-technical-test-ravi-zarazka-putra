import { db } from "../../db/connection-postgresql.js";
import { suppliers } from "../../db/schema/index.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import type { CreateSupplierInput } from "./supplier.schema.js";

type SupplierRow = typeof suppliers.$inferSelect;

function toDto(row: SupplierRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const NOT_FOUND = () => AppError.notFound("Supplier not found", "SUPPLIER_NOT_FOUND");

export async function createSupplier(input: CreateSupplierInput) {
  const [row] = await db.insert(suppliers).values(input).returning();
  if (!row) throw AppError.internal();
  return toDto(row);
}