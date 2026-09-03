import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  createWarehouseSchema,
  listWarehouseQuerySchema,
  warehouseListSchema,
  warehouseSchema,
  updateWarehouseSchema,
} from "./warehouse.schema.js";
import {
  createWarehouse,
  getWarehouseById,
  listWarehouses,
  updateWarehouse,
} from "./warehouse.service.js";

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

warehouseRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: TAG,
    summary: "Get a warehouse by id",
    ...AUTH,
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(warehouseSchema, "Warehouse"),
      404: errorResponse("Warehouse not found"),
    },
  }),
  async (c) => c.json(await getWarehouseById(c.req.valid("param").id), 200),
);

warehouseRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: TAG,
    summary: "Update a warehouse",
    ...AUTH,
    request: {
      params: idParamSchema,
      body: { content: { "application/json": { schema: updateWarehouseSchema } } },
    },
    responses: {
      200: jsonResponse(warehouseSchema, "Updated warehouse"),
      404: errorResponse("Warehouse not found"),
      409: errorResponse("Warehouse code already exists"),
      422: errorResponse("Validation error"),
    },
  }),
  async (c) => c.json(await updateWarehouse(c.req.valid("param").id, c.req.valid("json")), 200),
);
