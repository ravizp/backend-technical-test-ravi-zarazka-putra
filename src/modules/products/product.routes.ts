import { createRoute } from "@hono/zod-openapi";
import { protect } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  createProductSchema,
  listProductQuerySchema,
  productListSchema,
  productSchema,
  updateProductSchema,
} from "./product.schema.js";
import { createProduct, getProductById, listProducts, updateProduct } from "./product.service.js";

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

productRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: TAG,
    summary: "List products",
    ...AUTH,
    request: { query: listProductQuerySchema },
    responses: { 200: jsonResponse(productListSchema, "Paginated products") },
  }),
  async (c) => c.json(await listProducts(c.req.valid("query")), 200),
);

productRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: TAG,
    summary: "Get a product by id",
    ...AUTH,
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(productSchema, "Product"),
      404: errorResponse("Product not found"),
    },
  }),
  async (c) => c.json(await getProductById(c.req.valid("param").id), 200),
);

productRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: TAG,
    summary: "Update a product",
    ...AUTH,
    request: {
      params: idParamSchema,
      body: { content: { "application/json": { schema: updateProductSchema } } },
    },
    responses: {
      200: jsonResponse(productSchema, "Updated product"),
      404: errorResponse("Product not found"),
      409: errorResponse("SKU already exists"),
      422: errorResponse("Validation error"),
    },
  }),
  async (c) => c.json(await updateProduct(c.req.valid("param").id, c.req.valid("json")), 200),
);
