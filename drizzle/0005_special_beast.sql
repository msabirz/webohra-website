ALTER TABLE "order_items" DROP COLUMN IF EXISTS "fulfillment";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "paid_at";--> statement-breakpoint
DROP TYPE "public"."order_fulfillment";