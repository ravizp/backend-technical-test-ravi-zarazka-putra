import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { DocumentType } from "../../lib/types.js";
import { primaryId } from "./helpers/set-columns.js";

export const documentSequences = pgTable(
  "document_sequences",
  {
    id: primaryId,
    docType: text("doc_type").$type<DocumentType>().notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [
    unique("document_sequences_type_year_unique").on(t.docType, t.year),
    check("document_sequences_doc_type_check", sql`${t.docType} IN ('PR', 'PO', 'GR')`),
    check("document_sequences_last_number_check", sql`${t.lastNumber} >= 0`),
  ],
);

export type DocumentSequenceRow = typeof documentSequences.$inferSelect;
export type NewDocumentSequenceRow = typeof documentSequences.$inferInsert;
