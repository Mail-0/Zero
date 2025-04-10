ALTER TABLE "mail0_early_access" ALTER COLUMN "has_used_ticket" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mail0_early_access" ALTER COLUMN "has_used_ticket" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "mail0_early_access" ALTER COLUMN "has_used_ticket" DROP NOT NULL;