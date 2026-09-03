ALTER TYPE "public"."order_item_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cancelled_reason" varchar(300);