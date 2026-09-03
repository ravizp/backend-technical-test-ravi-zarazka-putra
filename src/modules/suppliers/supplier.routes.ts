import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, jsonResponse } from "../../openapi.js";
import { createSupplierSchema, supplierSchema } from "./supplier.schema.js";
import { createSupplier } from "./supplier.service.js";

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