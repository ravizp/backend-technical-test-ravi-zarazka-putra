import { inArray } from "drizzle-orm";
import { db } from "../connection-postgresql.js";
import { suppliers } from "../schema/index.js";

const SEED_SUPPLIERS = [
  { name: "PT Sumber Makmur", email: "sumber.makmur@example.com", phone: "+62-21-5550101" },
  { name: "CV Mitra Jaya", email: "mitra.jaya@example.com", phone: "+62-31-5550202" },
  { name: "PT Global Supply", email: "global.supply@example.com", phone: "+62-21-5550303" },
];

export async function seedSuppliers(): Promise<void> {
  const names = SEED_SUPPLIERS.map((s) => s.name);
  const existing = await db
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(inArray(suppliers.name, names));
  const existingNames = new Set(existing.map((r) => r.name));

  const toInsert = SEED_SUPPLIERS.filter((s) => !existingNames.has(s.name));
  if (toInsert.length > 0) {
    await db.insert(suppliers).values(toInsert);
  }

  console.info(
    `[seed:suppliers] inserted ${toInsert.length}, skipped ${SEED_SUPPLIERS.length - toInsert.length}`,
  );
}
