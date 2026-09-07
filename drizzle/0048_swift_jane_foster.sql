CREATE TYPE "public"."order_address_type" AS ENUM('buyer', 'seller');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "address_type" "order_address_type" DEFAULT 'buyer' NOT NULL;--> statement-breakpoint
-- Item 28 (2026-09-07) data backfill: the ADD COLUMN default above
-- stamped every existing row 'buyer', which is wrong for existing
-- pickup_and_pay orders — those already hold the SELLER's own address
-- (see orders.addressLine1's schema comment), just without an explicit
-- label until now. Correct them in the same migration so no order is
-- ever mislabeled between this deploy and a separate backfill script.
UPDATE "orders" SET "address_type" = 'seller' WHERE "payment_method" = 'pickup_and_pay';