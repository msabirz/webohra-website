ALTER TABLE "dispute_comments" ALTER COLUMN "staff_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "created_by_staff_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dispute_comments" ADD COLUMN "buyer_id" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "created_by_buyer_id" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "seller_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispute_comments" ADD CONSTRAINT "dispute_comments_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_created_by_buyer_id_users_id_fk" FOREIGN KEY ("created_by_buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
