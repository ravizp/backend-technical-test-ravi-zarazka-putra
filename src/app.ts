import { Hono } from "hono";
import { logger } from "hono/logger";
import { notFound, onError } from "./middleware/error-handler.js";

// Creates and configures Hono 
export function createApp(): Hono {
  const app = new Hono();

  app.use("*", logger());

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "inventory-procurement-api",
      time: new Date().toISOString(),
    }),
  );

  // app.route(); 

  app.notFound(notFound);
  app.onError(onError);

  return app;
}
