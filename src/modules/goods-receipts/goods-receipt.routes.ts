import { createRoute } from "@hono/zod-openapi";
import { currentUser, protect, type AuthEnv } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import { createGoodsReceiptSchema, goodsReceiptSchema } from "./goods-receipt.schema.js";
import { createGoodsReceipt, getGoodsReceiptById } from "./goods-receipt.service.js";

export const goodsReceiptRoutes = createRouter<AuthEnv>();

const TAG = ["Goods Receipts"];
const bearer = { security: [{ bearerAuth: [] }] };

// POST /api/goods-receipts — record a receipt (atomic: PO status + inventory + movement)
goodsReceiptRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: TAG,
    summary: "Record a Goods Receipt for a Purchase Order",
    ...bearer,
    middleware: protect("USER"),
    request: {
      body: { content: { "application/json": { schema: createGoodsReceiptSchema } } },
    },
    responses: {
      201: jsonResponse(goodsReceiptSchema, "Goods Receipt + the resulting PO status"),
      403: errorResponse("Only a USER can record a Goods Receipt"),
      404: errorResponse("Purchase Order not found"),
      409: errorResponse("Purchase Order is DRAFT / RECEIVED / CANCELLED"),
      422: errorResponse("Empty / invalid item / quantity exceeds ordered"),
    },
  }),
  async (c) => c.json(await createGoodsReceipt(c.req.valid("json"), currentUser(c).id), 201),
);

// GET /api/goods-receipts/{id}
goodsReceiptRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: TAG,
    summary: "Get a Goods Receipt by id",
    ...bearer,
    middleware: protect(),
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(goodsReceiptSchema, "Goods Receipt with items"),
      404: errorResponse("Goods Receipt not found"),
    },
  }),
  async (c) => c.json(await getGoodsReceiptById(c.req.valid("param").id), 200),
);
