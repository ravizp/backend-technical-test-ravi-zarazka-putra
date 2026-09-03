import { z } from "@hono/zod-openapi";
import { paginatedResponseSchema, paginationQuerySchema } from "../../lib/pagination.js";

export const supplierSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Supplier");

export const createSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(255).openapi({ example: "PT Baru Sejahtera" }),
    email: z.email().openapi({ example: "kontak@baru.example.com" }),
    phone: z.string().trim().min(1).max(32).openapi({ example: "+62-21-5559999" }),
    isActive: z.boolean().optional(),
  })
  .openapi("CreateSupplier");

export const updateSupplierSchema = createSupplierSchema.partial().openapi("UpdateSupplier");

export const listSupplierQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional().openapi({ example: "mitra" }),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const supplierListSchema = paginatedResponseSchema(supplierSchema);

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSupplierQuery = z.infer<typeof listSupplierQuerySchema>;
