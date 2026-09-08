CREATE TYPE "public"."tax_id_type" AS ENUM('gst', 'udyam');--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_type" "tax_id_type";--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_number" varchar(20);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_verified_by" integer;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "tax_id_rejected_reason" varchar(300);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_tax_id_verified_by_users_id_fk" FOREIGN KEY ("tax_id_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
