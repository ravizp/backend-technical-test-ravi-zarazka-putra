import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, jsonResponse } from "../../openapi.js";
import {
  inventoryStockListSchema,
  movementListSchema,
  movementQuerySchema,
  stockQuerySchema,
} from "./inventory.schema.js";
import { getStock, listMovements } from "./inventory.service.js";

// Endpoint baca-saja: saldo stok dan ledger pergerakannya. Stok cuma berubah lewat
// proses lain (Goods Receipt), jadi di sini tidak ada POST/PATCH.
export const inventoryRoutes = createRouter();

const TAG = ["Inventory"];
const AUTH = { security: [{ bearerAuth: [] }], middleware: protect() };

inventoryRoutes.openapi(
  createRoute({
    method: "get",
    path: "/inventory",
    tags: TAG,
    summary: "Stock balances (filter by warehouse and/or product)",
    ...AUTH,
    request: { query: stockQuerySchema },
    responses: { 200: jsonResponse(inventoryStockListSchema, "Stock balances") },
  }),
  async (c) => c.json(await getStock(c.req.valid("query")), 200),
);

inventoryRoutes.openapi(
  createRoute({
    method: "get",
    path: "/inventory-movements",
    tags: TAG,
    summary: "Inventory movement ledger (newest first)",
    ...AUTH,
    request: { query: movementQuerySchema },
    responses: { 200: jsonResponse(movementListSchema, "Paginated movements") },
  }),
  async (c) => c.json(await listMovements(c.req.valid("query")), 200),
);
