import { sql } from "../../src/db/connection-postgresql.js";

// Truncate all tables
export async function truncateAll(): Promise<void> {
  await sql`
    TRUNCATE TABLE
      goods_receipt_items, goods_receipts,
      inventory_movements, inventories,
      purchase_order_items, purchase_orders,
      purchase_request_items, purchase_requests,
      document_sequences, products, suppliers, warehouses, users
    RESTART IDENTITY CASCADE
  `;
}
