ALTER TABLE "mail0_user" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "mail0_user" ADD COLUMN "phone_number_verified" boolean;--> statement-breakpoint
ALTER TABLE "mail0_user" ADD CONSTRAINT "mail0_user_phone_number_unique" UNIQUE("phone_number");