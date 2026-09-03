CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movements_type_check" CHECK ("inventory_movements"."movement_type" IN ('PURCHASE_RECEIPT')),
	CONSTRAINT "inventory_movements_quantity_check" CHECK ("inventory_movements"."quantity" <> 0)
);
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_movements_wh_product_idx" ON "inventory_movements" USING btree ("warehouse_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" USING btree ("reference_type","reference_id");