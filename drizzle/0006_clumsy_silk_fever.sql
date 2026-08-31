CREATE TYPE "public"."order_status" AS ENUM('placed', 'cancelled');--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "slug" varchar(220);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_number" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" "order_status" DEFAULT 'placed' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(150);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(200);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");