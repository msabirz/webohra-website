CREATE TYPE "public"."billing_mode" AS ENUM('plan', 'recharge');--> statement-breakpoint
CREATE TYPE "public"."cancelled_by" AS ENUM('buyer', 'ops');--> statement-breakpoint
CREATE TYPE "public"."contact_mode" AS ENUM('whatsapp_number', 'direct_whatsapp', 'masked_relay');--> statement-breakpoint
CREATE TYPE "public"."pickup_address_source" AS ENUM('seller', 'office');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('product', 'service');--> statement-breakpoint
CREATE TYPE "public"."shipment_method" AS ENUM('self_managed', 'delhivery', 'pickup_and_pay');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'lapsed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('topup', 'commission_deduction', 'admin_adjustment');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"title" varchar(150) NOT NULL,
	"link" varchar(500),
	"image_url" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_ship_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"city" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_ship_cities_seller_city_unique" UNIQUE("seller_id","city")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"seller_type" "seller_type" NOT NULL,
	"billing_mode" "billing_mode" NOT NULL,
	"plan_id" integer,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"renews_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_subscriptions_seller_type_unique" UNIQUE("seller_id","seller_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_wallets_seller_id_unique" UNIQUE("seller_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"method" "shipment_method" NOT NULL,
	"charge" numeric(10, 2),
	"address_line1" varchar(200),
	"address_line2" varchar(200),
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"expected_at_office_by" timestamp with time zone,
	"arrived_at_office_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_type" "seller_type" NOT NULL,
	"tier_key" varchar(30) NOT NULL,
	"name" varchar(60) NOT NULL,
	"monthly_price" numeric(10, 2) NOT NULL,
	"max_active_listings" integer,
	"allows_pickup_and_pay" boolean DEFAULT false NOT NULL,
	"pickup_office_option" boolean DEFAULT false NOT NULL,
	"allows_delhivery" boolean DEFAULT false NOT NULL,
	"priority_support" boolean DEFAULT false NOT NULL,
	"reminders_enabled" boolean DEFAULT false NOT NULL,
	"contact_mode" "contact_mode",
	"bonus_other_category_listings" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_seller_type_tier_key_unique" UNIQUE("seller_type","tier_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_min_threshold" numeric(10, 2) DEFAULT '0' NOT NULL,
	"recharge_default_plan_id" integer,
	"bonus_listing_commission_percent" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"order_id" integer,
	"gateway_payment_id" varchar(100),
	"initiated_by_staff_id" integer,
	"reason" varchar(300),
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webohra_offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"address_line1" varchar(200) NOT NULL,
	"address_line2" varchar(200),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"contact_phone" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jamaats" ADD COLUMN "office_id" integer;--> statement-breakpoint
ALTER TABLE "listing_variants" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "self_ship_charge" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_address_source" "pickup_address_source";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "delhivery_pickup_source" "pickup_address_source";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pickup_lead_time_hours" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "show_address_on_pdp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by" "cancelled_by";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" varchar(300);--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "requested_time" varchar(5);--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "tracking_number" varchar(20);--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "ready_for_pickup_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "address_line1" varchar(200);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "address_line2" varchar(200);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "pincode" varchar(10);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_ship_cities" ADD CONSTRAINT "seller_ship_cities_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_wallets" ADD CONSTRAINT "seller_wallets_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipments" ADD CONSTRAINT "shipments_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_settings" ADD CONSTRAINT "subscription_settings_recharge_default_plan_id_subscription_plans_id_fk" FOREIGN KEY ("recharge_default_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_initiated_by_staff_id_users_id_fk" FOREIGN KEY ("initiated_by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jamaats" ADD CONSTRAINT "jamaats_office_id_webohra_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."webohra_offices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_tracking_number_unique" UNIQUE("tracking_number");