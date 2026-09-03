import { createRoute } from "@hono/zod-openapi";
import { currentUser, protect, type AuthEnv } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  createPurchaseOrderSchema,
  listPurchaseOrderQuerySchema,
  purchaseOrderListSchema,
  purchaseOrderSchema,
} from "./purchase-order.schema.js";
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  listPurchaseOrders,
  markPurchaseOrderAsOrdered,
} from "./purchase-order.service.js";
import { goodsReceiptListSchema } from "../goods-receipts/goods-receipt.schema.js";
import { listGoodsReceiptsForPurchaseOrder } from "../goods-receipts/goods-receipt.service.js";

export const purchaseOrderRoutes = createRouter<AuthEnv>();

const TAG = ["Purchase Orders"];
const bearer = { security: [{ bearerAuth: [] }] };

purchaseOrderRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: TAG,
    summary: "Create a Purchase Order from an APPROVED Purchase Request",
    ...bearer,
    middleware: protect("USER"),
    request: {
      body: { content: { "application/json": { schema: createPurchaseOrderSchema } } },
    },
    responses: {
      201: jsonResponse(purchaseOrderSchema, "Created Purchase Order (status DRAFT)"),
      403: errorResponse("Only a USER can create a Purchase Order"),
      404: errorResponse("Purchase Request not found"),
      409: errorResponse("Purchase Request not APPROVED / already has a Purchase Order"),
      422: errorResponse("Supplier not found or inactive"),
    },
  }),
  async (c) => c.json(await createPurchaseOrder(c.req.valid("json"), currentUser(c).id), 201),
);

purchaseOrderRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: TAG,
    summary: "List Purchase Orders",
    ...bearer,
    middleware: protect(),
    request: { query: listPurchaseOrderQuerySchema },
    responses: { 200: jsonResponse(purchaseOrderListSchema, "Paginated Purchase Orders") },
  }),
  async (c) => c.json(await listPurchaseOrders(c.req.valid("query")), 200),
);

purchaseOrderRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: TAG,
    summary: "Get a Purchase Order by id",
    ...bearer,
    middleware: protect(),
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(purchaseOrderSchema, "Purchase Order with items"),
      404: errorResponse("Purchase Order not found"),
    },
  }),
  async (c) => c.json(await getPurchaseOrderById(c.req.valid("param").id), 200),
);

purchaseOrderRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{id}/mark-ordered",
    tags: TAG,
    summary: "Mark a DRAFT Purchase Order as ORDERED",
    ...bearer,
    middleware: protect("USER"),
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(purchaseOrderSchema, "Purchase Order (status ORDERED)"),
      403: errorResponse("Only a USER can mark a Purchase Order as ordered"),
      404: errorResponse("Purchase Order not found"),
      409: errorResponse("Purchase Order is not in DRAFT status"),
    },
  }),
  async (c) => c.json(await markPurchaseOrderAsOrdered(c.req.valid("param").id), 200),
);

purchaseOrderRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}/goods-receipts",
    tags: TAG,
    summary: "List the Goods Receipts recorded against a Purchase Order",
    ...bearer,
    middleware: protect(),
    request: { params: idParamSchema },
    responses: { 200: jsonResponse(goodsReceiptListSchema, "Goods Receipts for this PO, oldest first") },
  }),
  async (c) => c.json(await listGoodsReceiptsForPurchaseOrder(c.req.valid("param").id), 200),
);
