CREATE TYPE "public"."payout_method" AS ENUM('bank_account', 'upi');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'reversed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"gross_amount" numeric(10, 2) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"net_amount" numeric(10, 2) NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"razorpay_payout_id" varchar(100),
	"failure_reason" varchar(300),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_razorpay_payout_id_unique" UNIQUE("razorpay_payout_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_payout_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"method" "payout_method" NOT NULL,
	"razorpay_contact_id" varchar(100) NOT NULL,
	"razorpay_fund_account_id" varchar(100) NOT NULL,
	"display_label" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_payout_accounts_seller_id_unique" UNIQUE("seller_id"),
	CONSTRAINT "seller_payout_accounts_razorpay_fund_account_id_unique" UNIQUE("razorpay_fund_account_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "order_commission_percent" numeric(5, 2) DEFAULT '10.00' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
