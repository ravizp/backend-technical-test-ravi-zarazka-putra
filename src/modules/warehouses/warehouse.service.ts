import { and, count, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import { warehouses } from "../../db/schema/index.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { limitOffset, paginated } from "../../lib/pagination.js";
import type {
  CreateWarehouseInput,
  ListWarehouseQuery,
  UpdateWarehouseInput,
} from "./warehouse.schema.js";

type WarehouseRow = typeof warehouses.$inferSelect;

function toDto(row: WarehouseRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Dua error yang sering dipakai di file ini, dibungkus biar tidak nulis ulang terus.
const CODE_TAKEN = () =>
  AppError.conflict("A warehouse with this code already exists", "WAREHOUSE_CODE_ALREADY_EXISTS");
const NOT_FOUND = () => AppError.notFound("Warehouse not found", "WAREHOUSE_NOT_FOUND");

export async function createWarehouse(input: CreateWarehouseInput) {
  try {
    const [row] = await db.insert(warehouses).values(input).returning();
    if (!row) throw AppError.internal();
    return toDto(row);
  } catch (err) {
    // Biarkan DB yang jaga keunikan code (ada UNIQUE constraint), lalu terjemahkan
    // error-nya jadi 409 yang rapi. Lebih aman dari cek-dulu-baru-insert yang bisa race.
    if (isUniqueViolation(err, "warehouses_code_unique")) throw CODE_TAKEN();
    throw err;
  }
}

export async function getWarehouseById(id: string) {
  const [row] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
  if (!row) throw NOT_FOUND();
  return toDto(row);
}

export async function listWarehouses(query: ListWarehouseQuery) {
  const filters = [];
  if (query.q) {
    filters.push(
      or(
        ilike(warehouses.name, `%${query.q}%`),
        ilike(warehouses.code, `%${query.q}%`),
        ilike(warehouses.location, `%${query.q}%`),
      ),
    );
  }
  if (query.isActive !== undefined) filters.push(eq(warehouses.isActive, query.isActive));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(warehouses).where(where);
  const { limit, offset } = limitOffset(query);
  const rows = await db
    .select()
    .from(warehouses)
    .where(where)
    .orderBy(warehouses.createdAt)
    .limit(limit)
    .offset(offset);

  return paginated(rows.map(toDto), totalRow?.value ?? 0, query);
}

export async function updateWarehouse(id: string, input: UpdateWarehouseInput) {
  // PATCH tanpa field apa pun: tidak usah sentuh DB, cukup balikin data yang sekarang.
  if (Object.keys(input).length === 0) return getWarehouseById(id);
  try {
    const [row] = await db
      .update(warehouses)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(warehouses.id, id))
      .returning();
    if (!row) throw NOT_FOUND();
    return toDto(row);
  } catch (err) {
    if (isUniqueViolation(err, "warehouses_code_unique")) throw CODE_TAKEN();
    throw err;
  }
}
