ALTER TABLE "enquiries" ADD COLUMN "variant_id" integer;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "variant_name" varchar(100);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_name" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_variant_id_listing_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."listing_variants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_listing_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."listing_variants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
