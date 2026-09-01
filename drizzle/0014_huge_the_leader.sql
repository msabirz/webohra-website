CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'select', 'multi_select', 'boolean', 'textarea', 'image');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "listing_field_values_listing_field_unique" UNIQUE("listing_id","field_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subcategory_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"subcategory_id" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"field_type" "field_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subcategory_fields_subcategory_key_unique" UNIQUE("subcategory_id","field_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_field_values" ADD CONSTRAINT "listing_field_values_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_field_values" ADD CONSTRAINT "listing_field_values_field_id_subcategory_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."subcategory_fields"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subcategory_fields" ADD CONSTRAINT "subcategory_fields_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
