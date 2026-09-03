CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."order_payment_status" ADD VALUE 'refunded';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispute_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispute_id" integer NOT NULL,
	"staff_id" integer NOT NULL,
	"note" varchar(1000),
	"status_changed_to" "dispute_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"reason" varchar(500) NOT NULL,
	"assigned_to_staff_id" integer,
	"created_by_staff_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"razorpay_refund_id" varchar(100),
	"amount" numeric(10, 2) NOT NULL,
	"reason" varchar(300) NOT NULL,
	"status" "refund_status" DEFAULT 'processing' NOT NULL,
	"failure_reason" varchar(300),
	"initiated_by_staff_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "refunds_razorpay_refund_id_unique" UNIQUE("razorpay_refund_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispute_comments" ADD CONSTRAINT "dispute_comments_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispute_comments" ADD CONSTRAINT "dispute_comments_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_to_staff_id_users_id_fk" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_created_by_staff_id_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_staff_id_users_id_fk" FOREIGN KEY ("initiated_by_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
