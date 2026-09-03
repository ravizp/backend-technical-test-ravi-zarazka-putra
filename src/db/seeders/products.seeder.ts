import { db } from "../connection-postgresql.js";
import { products } from "../schema/index.js";

const SEED_PRODUCTS = [
  { sku: "OIL-001", name: "Industrial Oil", unit: "PCS" },
  { sku: "GLV-001", name: "Safety Gloves", unit: "BOX" },
  { sku: "BLT-001", name: "Steel Bolts", unit: "PCS" },
  { sku: "HLM-001", name: "Safety Helmet", unit: "PCS" },
  { sku: "TAP-001", name: "Duct Tape", unit: "ROLL" },
];

export async function seedProducts(): Promise<void> {
  const inserted = await db
    .insert(products)
    .values(SEED_PRODUCTS)
    .onConflictDoNothing({ target: products.sku })
    .returning({ sku: products.sku });

  console.info(
    `[seed:products] inserted ${inserted.length}, skipped ${SEED_PRODUCTS.length - inserted.length}`,
  );
}
