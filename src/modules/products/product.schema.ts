import { z } from "@hono/zod-openapi";
import { paginatedResponseSchema, paginationQuerySchema } from "../../lib/pagination.js";

export const productSchema = z
  .object({
    id: z.uuid(),
    sku: z.string(),
    name: z.string(),
    unit: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Product");

export const createProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).openapi({ example: "OIL-002" }),
    name: z.string().trim().min(1).max(255).openapi({ example: "Synthetic Oil" }),
    unit: z.string().trim().min(1).max(32).openapi({ example: "PCS" }),
    isActive: z.boolean().optional(),
  })
  .openapi("CreateProduct");

export const updateProductSchema = createProductSchema.partial().openapi("UpdateProduct");

export const listProductQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional().openapi({ example: "oil" }),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const productListSchema = paginatedResponseSchema(productSchema);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductQuery = z.infer<typeof listProductQuerySchema>;
