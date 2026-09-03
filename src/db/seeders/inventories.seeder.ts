import { db } from "../connection-postgresql.js";
import { inventories, products, warehouses } from "../schema/index.js";

// warehouse code, product SKU, quantity
const SEED_STOCK: [string, string, number][] = [
  ["JKT", "OIL-001", 120],
  ["SBY", "OIL-001", 45],
  ["JKT", "GLV-001", 50],
  ["JKT", "BLT-001", 200],
  ["SBY", "HLM-001", 30],
];

export async function seedInventories(): Promise<void> {
  const whRows = await db.select({ id: warehouses.id, code: warehouses.code }).from(warehouses);
  const prRows = await db.select({ id: products.id, sku: products.sku }).from(products);
  const whByCode = new Map(whRows.map((w) => [w.code, w.id]));
  const prBySku = new Map(prRows.map((p) => [p.sku, p.id]));

  const rows = SEED_STOCK.flatMap(([code, sku, quantity]) => {
    const warehouseId = whByCode.get(code);
    const productId = prBySku.get(sku);
    return warehouseId && productId ? [{ warehouseId, productId, quantity }] : [];
  });

  if (rows.length === 0) {
    console.info("[seed:inventories] no matching warehouses/products — run those seeders first");
    return;
  }

  const inserted = await db
    .insert(inventories)
    .values(rows)
    .onConflictDoNothing({ target: [inventories.warehouseId, inventories.productId] })
    .returning({ id: inventories.id });

  console.info(
    `[seed:inventories] inserted ${inserted.length}, skipped ${rows.length - inserted.length}`,
  );
}
