CREATE TABLE "goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"received_quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_items_received_qty_check" CHECK ("goods_receipt_items"."received_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "gr_items_gr_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "gr_items_po_item_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goods_receipt_items_gr_idx" ON "goods_receipt_items" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_items_po_item_idx" ON "goods_receipt_items" USING btree ("purchase_order_item_id");