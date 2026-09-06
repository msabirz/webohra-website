ALTER TABLE "subscription_settings" ADD COLUMN "whatsapp_connect_fee_rupees" numeric(10, 2) DEFAULT '20.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "whatsapp_lead_fee_rupees" numeric(10, 2) DEFAULT '35.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD COLUMN "whatsapp_connect_daily_limit_per_buyer" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "buyer_id" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "billed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "billed_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
