import { z } from "@hono/zod-openapi";

// Pagination query parameters schema
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({ example: 1 }),
  pageSize: z.coerce.number().int().positive().max(100).default(20).openapi({ example: 20 }),
});

export type Pagination = z.infer<typeof paginationQuerySchema>;

// Paginated response schema and helper functions
export function paginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

export function paginated<T>(data: T[], total: number, { page, pageSize }: Pagination) {
  return { data, page, pageSize, total };
}

// Pagination limit and offset helper
export function limitOffset({ page, pageSize }: Pagination) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
