ALTER TYPE "public"."order_item_status" ADD VALUE 'returned';--> statement-breakpoint
ALTER TYPE "public"."wallet_transaction_type" ADD VALUE 'commission_reversal';--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "created_by_seller_id" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "amount" numeric(10, 2);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_created_by_seller_id_users_id_fk" FOREIGN KEY ("created_by_seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
