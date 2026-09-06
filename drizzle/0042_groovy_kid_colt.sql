CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient" varchar(200) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"event" varchar(50) NOT NULL,
	"related_id" integer,
	"status" "notification_status" NOT NULL,
	"failure_reason" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
