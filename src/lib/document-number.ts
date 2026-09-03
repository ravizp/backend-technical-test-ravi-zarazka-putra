import { sql } from "drizzle-orm";
import type { db } from "../db/connection-postgresql.js";
import { documentSequences } from "../db/schema/index.js";
import type { DocumentType } from "./types.js";

// Database type for transaction
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Allocate the next document number for `docType` in the current year, e.g., `PR-2026-000001`.
export async function nextDocumentNumber(tx: DbClient, docType: DocumentType): Promise<string> {
  const year = new Date().getFullYear();

  const [row] = await tx
    .insert(documentSequences)
    .values({ docType, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequences.docType, documentSequences.year],
      set: { lastNumber: sql`${documentSequences.lastNumber} + 1` },
    })
    .returning({ lastNumber: documentSequences.lastNumber });

  const serial = String(row?.lastNumber ?? 1).padStart(6, "0");
  return `${docType}-${year}-${serial}`;
}
