import { and, count, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import { suppliers } from "../../db/schema/index.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { limitOffset, paginated } from "../../lib/pagination.js";
import type { CreateSupplierInput, ListSupplierQuery } from "./supplier.schema.js";

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

export async function getSupplierById(id: string) {
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!row) throw NOT_FOUND();
  return toDto(row);
}

export async function listSuppliers(query: ListSupplierQuery) {
  const filters = [];
  if (query.q) {
    filters.push(or(ilike(suppliers.name, `%${query.q}%`), ilike(suppliers.email, `%${query.q}%`)));
  }
  if (query.isActive !== undefined) filters.push(eq(suppliers.isActive, query.isActive));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(suppliers).where(where);
  const { limit, offset } = limitOffset(query);
  const rows = await db
    .select()
    .from(suppliers)
    .where(where)
    .orderBy(suppliers.createdAt)
    .limit(limit)
    .offset(offset);

  return paginated(rows.map(toDto), totalRow?.value ?? 0, query);
}