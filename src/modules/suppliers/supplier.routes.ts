import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  createSupplierSchema,
  listSupplierQuerySchema,
  supplierListSchema,
  supplierSchema,
  updateSupplierSchema,
} from "./supplier.schema.js";
import {
  createSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
} from "./supplier.service.js";

export const supplierRoutes = createRouter();

const TAG = ["Suppliers"];
const AUTH = { security: [{ bearerAuth: [] }], middleware: protect() };

supplierRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: TAG,
    summary: "Create a supplier",
    ...AUTH,
    request: { body: { content: { "application/json": { schema: createSupplierSchema } } } },
    responses: {
      201: jsonResponse(supplierSchema, "Created supplier"),
      422: errorResponse("Validation error"),
    },
  }),
  async (c) => c.json(await createSupplier(c.req.valid("json")), 201),
);

supplierRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: TAG,
    summary: "List suppliers",
    ...AUTH,
    request: { query: listSupplierQuerySchema },
    responses: { 200: jsonResponse(supplierListSchema, "Paginated suppliers") },
  }),
  async (c) => c.json(await listSuppliers(c.req.valid("query")), 200),
);

supplierRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: TAG,
    summary: "Get a supplier by id",
    ...AUTH,
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(supplierSchema, "Supplier"),
      404: errorResponse("Supplier not found"),
    },
  }),
  async (c) => c.json(await getSupplierById(c.req.valid("param").id), 200),
);

supplierRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: TAG,
    summary: "Update a supplier",
    ...AUTH,
    request: {
      params: idParamSchema,
      body: { content: { "application/json": { schema: updateSupplierSchema } } },
    },
    responses: {
      200: jsonResponse(supplierSchema, "Updated supplier"),
      404: errorResponse("Supplier not found"),
      422: errorResponse("Validation error"),
    },
  }),
  async (c) => c.json(await updateSupplier(c.req.valid("param").id, c.req.valid("json")), 200),
);
