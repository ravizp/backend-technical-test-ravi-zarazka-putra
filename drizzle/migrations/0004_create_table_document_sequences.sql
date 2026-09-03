CREATE TABLE "document_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_type" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_sequences_type_year_unique" UNIQUE("doc_type","year"),
	CONSTRAINT "document_sequences_doc_type_check" CHECK ("document_sequences"."doc_type" IN ('PR', 'PO', 'GR')),
	CONSTRAINT "document_sequences_last_number_check" CHECK ("document_sequences"."last_number" >= 0)
);
