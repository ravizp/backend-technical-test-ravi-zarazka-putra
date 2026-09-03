import { db } from "../../db/connection-postgresql.js";
import { products } from "../../db/schema/index.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { AppError } from "../../lib/error-handler-http-status-codes.js";
import type { CreateProductInput } from "./product.schema.js";

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

const SKU_TAKEN = () =>
  AppError.conflict("A product with this SKU already exists", "SKU_ALREADY_EXISTS");
const NOT_FOUND = () => AppError.notFound("Product not found", "PRODUCT_NOT_FOUND");

export async function createProduct(input: CreateProductInput) {
  try {
    const [row] = await db.insert(products).values(input).returning();
    if (!row) throw AppError.internal();
    return toDto(row);
  } catch (err) {
    if (isUniqueViolation(err, "products_sku_unique")) throw SKU_TAKEN();
    throw err;
  }
}

