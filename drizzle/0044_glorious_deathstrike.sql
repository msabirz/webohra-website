ALTER TYPE "public"."payment_method" ADD VALUE 'pickup_and_pay';--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "pickup_scheduled_date" varchar(10);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "pickup_scheduled_time" varchar(5);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "pickup_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "pickup_and_pay_checkout_fee_percent" numeric(5, 2) DEFAULT '6.00' NOT NULL;