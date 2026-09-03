import bcrypt from "bcryptjs";
import { db } from "../../src/db/connection-postgresql.js";
import { products, suppliers, users, warehouses } from "../../src/db/schema/index.js";
import { signToken } from "../../src/lib/jwt.js";

// seedBasics inserts a set of basic fixtures into the database
export async function seedBasics() {
  const passwordHash = await bcrypt.hash("secret123", 4);

  const [user] = await db
    .insert(users)
    .values({ name: "User One", email: "user1@test.local", passwordHash, role: "USER" })
    .returning();
  const [user2] = await db
    .insert(users)
    .values({ name: "User Two", email: "user2@test.local", passwordHash, role: "USER" })
    .returning();
  const [approver] = await db
    .insert(users)
    .values({ name: "Approver", email: "approver@test.local", passwordHash, role: "APPROVER" })
    .returning();

  const [warehouse] = await db
    .insert(warehouses)
    .values({ code: "WH-TEST", name: "Test Warehouse", location: "Testville" })
    .returning();
  const [supplier] = await db
    .insert(suppliers)
    .values({ name: "Test Supplier", email: "supplier@test.local", phone: "0000" })
    .returning();
  const [productA] = await db
    .insert(products)
    .values({ sku: "SKU-A", name: "Product A", unit: "PCS" })
    .returning();
  const [productB] = await db
    .insert(products)
    .values({ sku: "SKU-B", name: "Product B", unit: "BOX" })
    .returning();

  if (!user || !user2 || !approver || !warehouse || !supplier || !productA || !productB) {
    throw new Error("fixture seeding failed");
  }

  return {
    user,
    user2,
    approver,
    warehouse,
    supplier,
    productA,
    productB,
    userToken: await signToken(user),
    user2Token: await signToken(user2),
    approverToken: await signToken(approver),
  };
}

export type Fixtures = Awaited<ReturnType<typeof seedBasics>>;
