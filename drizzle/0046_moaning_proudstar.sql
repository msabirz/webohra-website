ALTER TYPE "public"."pickup_address_source" ADD VALUE 'other';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_other_address_line1" varchar(200);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_other_address_line2" varchar(200);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_other_address_city" varchar(100);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_other_address_state" varchar(100);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_other_address_pincode" varchar(10);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "pickup_other_address_line1" varchar(200);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "pickup_other_address_line2" varchar(200);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "pickup_other_address_city" varchar(100);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "pickup_other_address_state" varchar(100);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "pickup_other_address_pincode" varchar(10);--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "pickup_office_feature_enabled" boolean DEFAULT true NOT NULL;