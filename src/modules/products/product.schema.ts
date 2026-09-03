import { z } from "@hono/zod-openapi";

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

export type CreateProductInput = z.infer<typeof createProductSchema>;
