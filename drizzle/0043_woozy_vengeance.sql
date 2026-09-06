ALTER TABLE "disputes" ADD COLUMN "order_item_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "razorpay_fee_percent" numeric(5, 2) DEFAULT '2.36' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "delhivery_cost_per_shipment" numeric(10, 2) DEFAULT '80.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "settlement_buffer_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
