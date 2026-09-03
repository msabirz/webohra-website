CREATE TYPE "public"."payout_channel" AS ENUM('razorpayx', 'manual');--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "channel" "payout_channel";--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "actioned_by_staff_id" integer;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "manual_note" varchar(300);--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "razorpayx_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_actioned_by_staff_id_users_id_fk" FOREIGN KEY ("actioned_by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
