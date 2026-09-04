import { and, count, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/connection-postgresql.js";
import { products } from "../../db/schema/index.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import { limitOffset, paginated } from "../../lib/pagination.js";
import type { CreateProductInput, ListProductQuery, UpdateProductInput } from "./product.schema.js";

type ProductRow = typeof products.$inferSelect;

function toDto(row: ProductRow) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Dua error yang sering dipakai di file ini, dibungkus biar tidak nulis ulang terus.
const SKU_TAKEN = () =>
  AppError.conflict("A product with this SKU already exists", "SKU_ALREADY_EXISTS");
const NOT_FOUND = () => AppError.notFound("Product not found", "PRODUCT_NOT_FOUND");

export async function createProduct(input: CreateProductInput) {
  try {
    const [row] = await db.insert(products).values(input).returning();
    if (!row) throw AppError.internal();
    return toDto(row);
  } catch (err) {
    // Biarkan DB yang jaga keunikan SKU (ada UNIQUE constraint), lalu terjemahkan
    // error-nya jadi 409 yang rapi. Lebih aman dari cek-dulu-baru-insert yang bisa race.
    if (isUniqueViolation(err, "products_sku_unique")) throw SKU_TAKEN();
    throw err;
  }
}

export async function getProductById(id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) throw NOT_FOUND();
  return toDto(row);
}

export async function listProducts(query: ListProductQuery) {
  const filters = [];
  if (query.q) {
    filters.push(or(ilike(products.name, `%${query.q}%`), ilike(products.sku, `%${query.q}%`)));
  }
  if (query.isActive !== undefined) filters.push(eq(products.isActive, query.isActive));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(products).where(where);
  const { limit, offset } = limitOffset(query);
  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(products.createdAt)
    .limit(limit)
    .offset(offset);

  return paginated(rows.map(toDto), totalRow?.value ?? 0, query);
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  // PATCH tanpa field apa pun: tidak usah sentuh DB, cukup balikin data yang sekarang.
  if (Object.keys(input).length === 0) return getProductById(id);
  try {
    const [row] = await db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    if (!row) throw NOT_FOUND();
    return toDto(row);
  } catch (err) {
    if (isUniqueViolation(err, "products_sku_unique")) throw SKU_TAKEN();
    throw err;
  }
}
