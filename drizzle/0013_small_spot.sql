CREATE TYPE "public"."order_item_status" AS ENUM('placed', 'packed', 'shipped', 'delivered');--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "status" "order_item_status" DEFAULT 'placed' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "status_updated_at" timestamp with time zone;