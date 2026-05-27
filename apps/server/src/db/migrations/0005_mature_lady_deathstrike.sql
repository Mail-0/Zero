ALTER TABLE "mail0_google_connection" RENAME TO "mail0_connection";--> statement-breakpoint
ALTER TABLE "mail0_connection" DROP CONSTRAINT "mail0_google_connection_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD COLUMN "provider_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mail0_session" ADD COLUMN "connectionId" text;--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_email_unique" UNIQUE("email");