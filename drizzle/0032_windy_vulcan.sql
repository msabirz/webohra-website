CREATE TABLE IF NOT EXISTS "payout_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "category_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_category_id_payout_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."payout_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
