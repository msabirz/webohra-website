CREATE TABLE IF NOT EXISTS "legal_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"title" varchar(150) NOT NULL,
	"content" text NOT NULL,
	"updated_by_staff_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_updated_by_staff_id_users_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
