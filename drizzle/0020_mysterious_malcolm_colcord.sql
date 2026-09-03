CREATE TYPE "public"."order_payment_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "order_payment_status";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "razorpay_order_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "razorpay_payment_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id");