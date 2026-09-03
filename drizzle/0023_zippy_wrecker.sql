ALTER TABLE "seller_payout_accounts" ALTER COLUMN "razorpay_contact_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_payout_accounts" ALTER COLUMN "razorpay_fund_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_payout_accounts" ADD COLUMN "upi_vpa" varchar(100);--> statement-breakpoint
ALTER TABLE "seller_payout_accounts" ADD COLUMN "qr_image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "public"."seller_payout_accounts" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payout_method";--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('upi', 'bank_account', 'qr_image');--> statement-breakpoint
ALTER TABLE "public"."seller_payout_accounts" ALTER COLUMN "method" SET DATA TYPE "public"."payout_method" USING "method"::"public"."payout_method";