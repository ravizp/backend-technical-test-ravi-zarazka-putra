import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  createWarehouseSchema,
  listWarehouseQuerySchema,
  warehouseListSchema,
  warehouseSchema,
} from "./warehouse.schema.js";
import { createWarehouse, listWarehouses } from "./warehouse.service.js";

export const warehouseRoutes = createRouter();

const TAG = ["Warehouses"];
const AUTH = { security: [{ bearerAuth: [] }], middleware: protect() };

warehouseRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: TAG,
    summary: "Create a warehouse",
    ...AUTH,
    request: { body: { content: { "application/json": { schema: createWarehouseSchema } } } },
    responses: {
      201: jsonResponse(warehouseSchema, "Created warehouse"),
      409: errorResponse("Warehouse code already exists"),
      422: errorResponse("Validation error"),
    },
  }),
  async (c) => c.json(await createWarehouse(c.req.valid("json")), 201),
);

warehouseRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: TAG,
    summary: "List warehouses",
    ...AUTH,
    request: { query: listWarehouseQuerySchema },
    responses: { 200: jsonResponse(warehouseListSchema, "Paginated warehouses") },
  }),
  async (c) => c.json(await listWarehouses(c.req.valid("query")), 200),
);
