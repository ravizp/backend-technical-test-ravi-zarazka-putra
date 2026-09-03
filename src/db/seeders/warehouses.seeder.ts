import { db } from "../connection-postgresql.js";
import { warehouses } from "../schema/index.js";

const SEED_WAREHOUSES = [
  { code: "JKT", name: "Jakarta Warehouse", location: "Jakarta" },
  { code: "SBY", name: "Surabaya Warehouse", location: "Surabaya" },
];

export async function seedWarehouses(): Promise<void> {
  const inserted = await db
    .insert(warehouses)
    .values(SEED_WAREHOUSES)
    .onConflictDoNothing({ target: warehouses.code })
    .returning({ code: warehouses.code });

  console.info(
    `[seed:warehouses] inserted ${inserted.length}, skipped ${SEED_WAREHOUSES.length - inserted.length}`,
  );
}
