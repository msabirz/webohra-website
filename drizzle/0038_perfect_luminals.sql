CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'investigating', 'resolved');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_ticket_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"created_by_user_id" integer,
	"name" varchar(150) NOT NULL,
	"email" varchar(200),
	"phone" varchar(20),
	"message" varchar(2000) NOT NULL,
	"status" "support_ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_to_staff_id" integer,
	"staff_note" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_category_id_support_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."support_ticket_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_staff_id_users_id_fk" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
