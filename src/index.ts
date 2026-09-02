import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.info(`Inventory Procurement API listening on http://localhost:${info.port}`);
});

function shutdown(signal: string): void {
  console.info(`\n${signal} received, shutting down...`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
