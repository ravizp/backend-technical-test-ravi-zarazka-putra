import { createRoute } from "@hono/zod-openapi";
import { currentUser, protect, type AuthEnv } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  createPurchaseRequestSchema,
  purchaseRequestSchema,
} from "./purchase-request.schema.js";
import { createPurchaseRequest, getPurchaseRequestById } from "./purchase-request.service.js";

export const purchaseRequestRoutes = createRouter<AuthEnv>();

const TAG = ["Purchase Requests"];
const bearer = { security: [{ bearerAuth: [] }] };

purchaseRequestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: TAG,
    summary: "Create a Purchase Request (status DRAFT)",
    ...bearer,
    middleware: protect("USER"),
    request: {
      body: { content: { "application/json": { schema: createPurchaseRequestSchema } } },
    },
    responses: {
      201: jsonResponse(purchaseRequestSchema, "Created Purchase Request"),
      403: errorResponse("Only a USER can create a Purchase Request"),
      422: errorResponse("Validation / inactive warehouse or product / duplicate product"),
    },
  }),
  async (c) => c.json(await createPurchaseRequest(c.req.valid("json"), currentUser(c).id), 201),
);

purchaseRequestRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    tags: TAG,
    summary: "Get a Purchase Request by id",
    ...bearer,
    middleware: protect(),
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(purchaseRequestSchema, "Purchase Request with items"),
      404: errorResponse("Purchase Request not found"),
    },
  }),
  async (c) => c.json(await getPurchaseRequestById(c.req.valid("param").id), 200),
);