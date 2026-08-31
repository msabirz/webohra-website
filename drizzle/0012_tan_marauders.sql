ALTER TABLE "enquiries" DROP CONSTRAINT "enquiries_buyer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "buyer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "request_number" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "buyer_name" varchar(150) NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "buyer_phone" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "message" varchar(500);--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "rejection_reason" varchar(300);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_request_number_unique" UNIQUE("request_number");--> statement-breakpoint
-- The enum type must be fully swapped (including dropping the old default,
-- which references the old type) BEFORE setting the new 'initiated'
-- default — that value doesn't exist in the old enum, so setting it first
-- fails outright.
ALTER TABLE "enquiries" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."enquiries" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."enquiry_status";--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('initiated', 'viewed', 'accepted', 'rejected', 'completed', 'auto_closed_no_update');--> statement-breakpoint
ALTER TABLE "public"."enquiries" ALTER COLUMN "status" SET DATA TYPE "public"."enquiry_status" USING "status"::"public"."enquiry_status";--> statement-breakpoint
ALTER TABLE "enquiries" ALTER COLUMN "status" SET DEFAULT 'initiated';
