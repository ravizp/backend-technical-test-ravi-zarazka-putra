import { z } from "@hono/zod-openapi";
import { paginatedResponseSchema, paginationQuerySchema } from "../../lib/pagination.js";

export const warehouseSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    location: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Warehouse");

export const createWarehouseSchema = z
  .object({
    code: z.string().trim().min(1).max(32).openapi({ example: "BDG" }),
    name: z.string().trim().min(1).max(255).openapi({ example: "Bandung Warehouse" }),
    location: z.string().trim().min(1).max(255).openapi({ example: "Bandung" }),
    isActive: z.boolean().optional(),
  })
  .openapi("CreateWarehouse");

export const updateWarehouseSchema = createWarehouseSchema.partial().openapi("UpdateWarehouse");

export const listWarehouseQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional().openapi({ example: "jakarta" }),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const warehouseListSchema = paginatedResponseSchema(warehouseSchema);

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type ListWarehouseQuery = z.infer<typeof listWarehouseQuerySchema>;
