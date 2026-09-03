import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { logger } from "hono/logger";
import { notFound, onError } from "./middleware/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { productRoutes } from "./modules/products/product.routes.js";
import { supplierRoutes } from "./modules/suppliers/supplier.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { warehouseRoutes } from "./modules/warehouses/warehouse.routes.js";

// Create the main app with all routes and middleware
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use("*", logger());

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "inventory-procurement-api",
      time: new Date().toISOString(),
    }),
  );

  // Feature modules
  app.route("/api/auth", authRoutes);
  app.route("/api/products", productRoutes);
  app.route("/api/suppliers", supplierRoutes);
  app.route("/api/warehouses", warehouseRoutes);
  app.route("/api", inventoryRoutes);

  // OpenAPI spec + Swagger UI
  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: { title: "Inventory Procurement API", version: "1.0.0" },
  });
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));

  app.notFound(notFound);
  app.onError(onError);

  return app;
}
