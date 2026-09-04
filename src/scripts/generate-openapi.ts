import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, openApiDocumentConfig } from "../app.js";

// Specify the output path for the generated OpenAPI document
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/openapi.json");

const app = createApp();
const document = app.getOpenAPIDocument(openApiDocumentConfig);

writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
console.info(`[docs:openapi] wrote ${OUTPUT}`);
