ALTER TABLE "mail0_connection" DROP CONSTRAINT "mail0_connection_email_unique";--> statement-breakpoint
ALTER TABLE "mail0_early_access" ADD COLUMN "is_early_access" boolean DEFAULT false NOT NULL;