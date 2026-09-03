import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, jsonResponse } from "../../openapi.js";
import {
  createProductSchema,
  productSchema,
} from "./product.schema.js";
import { createProduct } from "./product.service.js";

export const productRoutes = createRouter();

const TAG = ["Products"];
const AUTH = { security: [{ bearerAuth: [] }], middleware: protect() };

productRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: TAG,
    summary: "Create a product",
    ...AUTH,
    request: { body: { content: { "application/json": { schema: createProductSchema } } } },
    responses: {
      201: jsonResponse(productSchema, "Created product"),
      409: errorResponse("SKU already exists"),
      422: errorResponse("Validation error"),
    },
  }),
  async (c) => c.json(await createProduct(c.req.valid("json")), 201),
);
