ALTER TABLE "seller_payout_accounts" DROP COLUMN IF EXISTS "qr_image_url";--> statement-breakpoint
ALTER TABLE "public"."seller_payout_accounts" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payout_method";--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('upi', 'bank_account');--> statement-breakpoint
ALTER TABLE "public"."seller_payout_accounts" ALTER COLUMN "method" SET DATA TYPE "public"."payout_method" USING "method"::"public"."payout_method";