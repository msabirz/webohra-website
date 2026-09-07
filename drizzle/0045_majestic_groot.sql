ALTER TABLE "seller_profiles" ADD COLUMN "slug" varchar(220);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_slug_unique" UNIQUE("slug");