import { createRoute } from "@hono/zod-openapi";
import { currentUser, protect, type AuthEnv } from "../auth/auth.middleware.js";
import { createRouter, errorResponse, idParamSchema, jsonResponse } from "../../openapi.js";
import {
  addItemSchema,
  createPurchaseRequestSchema,
  prItemParamSchema,
  purchaseRequestSchema,
  updateItemSchema,
  updatePurchaseRequestSchema,
} from "./purchase-request.schema.js";
import {
  addPurchaseRequestItem,
  approvePurchaseRequest,
  createPurchaseRequest,
  getPurchaseRequestById,
  removePurchaseRequestItem,
  submitPurchaseRequest,
  updatePurchaseRequestItem,
  updatePurchaseRequestWarehouse,
} from "./purchase-request.service.js";

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

// draft editing: owner + DRAFT only
const draftEditResponses = {
  200: jsonResponse(purchaseRequestSchema, "Updated Purchase Request"),
  403: errorResponse("Not the owner of this Purchase Request"),
  404: errorResponse("Purchase Request (or item) not found"),
  409: errorResponse("Purchase Request is no longer a DRAFT"),
  422: errorResponse("Validation / inactive product / duplicate product"),
};

purchaseRequestRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    tags: TAG,
    summary: "Change the warehouse of a DRAFT Purchase Request",
    ...bearer,
    middleware: protect("USER"),
    request: {
      params: idParamSchema,
      body: { content: { "application/json": { schema: updatePurchaseRequestSchema } } },
    },
    responses: draftEditResponses,
  }),
  async (c) =>
    c.json(
      await updatePurchaseRequestWarehouse(
        c.req.valid("param").id,
        currentUser(c).id,
        c.req.valid("json"),
      ),
      200,
    ),
);

purchaseRequestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{id}/items",
    tags: TAG,
    summary: "Add an item to a DRAFT Purchase Request",
    ...bearer,
    middleware: protect("USER"),
    request: {
      params: idParamSchema,
      body: { content: { "application/json": { schema: addItemSchema } } },
    },
    responses: { ...draftEditResponses, 201: draftEditResponses[200] },
  }),
  async (c) =>
    c.json(
      await addPurchaseRequestItem(c.req.valid("param").id, currentUser(c).id, c.req.valid("json")),
      201,
    ),
);

purchaseRequestRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{id}/items/{itemId}",
    tags: TAG,
    summary: "Change an item's quantity on a DRAFT Purchase Request",
    ...bearer,
    middleware: protect("USER"),
    request: {
      params: prItemParamSchema,
      body: { content: { "application/json": { schema: updateItemSchema } } },
    },
    responses: draftEditResponses,
  }),
  async (c) => {
    const p = c.req.valid("param");
    return c.json(
      await updatePurchaseRequestItem(p.id, p.itemId, currentUser(c).id, c.req.valid("json")),
      200,
    );
  },
);

purchaseRequestRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{id}/items/{itemId}",
    tags: TAG,
    summary: "Remove an item from a DRAFT Purchase Request",
    ...bearer,
    middleware: protect("USER"),
    request: { params: prItemParamSchema },
    responses: {
      204: { description: "Item removed" },
      403: errorResponse("Not the owner of this Purchase Request"),
      404: errorResponse("Purchase Request (or item) not found"),
      409: errorResponse("Purchase Request is no longer a DRAFT"),
    },
  }),
  async (c) => {
    const p = c.req.valid("param");
    await removePurchaseRequestItem(p.id, p.itemId, currentUser(c).id);
    return c.body(null, 204);
  },
);

// ---- submit: DRAFT -> SUBMITTED ----

purchaseRequestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{id}/submit",
    tags: TAG,
    summary: "Submit a DRAFT Purchase Request (DRAFT -> SUBMITTED)",
    ...bearer,
    middleware: protect("USER"),
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(purchaseRequestSchema, "Submitted Purchase Request"),
      403: errorResponse("Not the owner of this Purchase Request"),
      404: errorResponse("Purchase Request not found"),
      409: errorResponse("Purchase Request is not in DRAFT status"),
      422: errorResponse("Purchase Request has no items / a product is inactive"),
    },
  }),
  async (c) => c.json(await submitPurchaseRequest(c.req.valid("param").id, currentUser(c).id), 200),
);

//approval: APPROVER only, SUBMITTED only
purchaseRequestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{id}/approve",
    tags: TAG,
    summary: "Approve a SUBMITTED Purchase Request (SUBMITTED -> APPROVED)",
    ...bearer,
    middleware: protect("APPROVER"),
    request: { params: idParamSchema },
    responses: {
      200: jsonResponse(purchaseRequestSchema, "Approved Purchase Request"),
      403: errorResponse("Only an APPROVER can approve"),
      404: errorResponse("Purchase Request not found"),
      409: errorResponse("Purchase Request is not SUBMITTED"),
    },
  }),
  async (c) => c.json(await approvePurchaseRequest(c.req.valid("param").id, currentUser(c).id), 200),
);