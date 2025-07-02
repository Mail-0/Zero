ALTER TABLE "mail0_organization_domain" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mail0_organization_domain" ADD COLUMN "verificationToken" text;