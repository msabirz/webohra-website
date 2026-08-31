CREATE TYPE "public"."pickup_request_status" AS ENUM('pending', 'received', 'issue');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "moderation_note" varchar(300);--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "status" "pickup_request_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "notes" varchar(300);--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "handled_by_staff_id" integer;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subcategories" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subcategories" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_handled_by_staff_id_users_id_fk" FOREIGN KEY ("handled_by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
