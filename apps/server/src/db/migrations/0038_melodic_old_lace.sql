CREATE TABLE "mail0_connection_imap" (
	"connection_id" text PRIMARY KEY NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" integer NOT NULL,
	"imap_security" text NOT NULL,
	"imap_username" text NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_security" text NOT NULL,
	"smtp_username" text NOT NULL,
	"auth_method" text NOT NULL,
	"oauth_provider" text,
	"encrypted_secret" text NOT NULL,
	"iv" text NOT NULL,
	"key_version" integer NOT NULL,
	"server_saves_sent" boolean DEFAULT false NOT NULL,
	"capabilities" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail0_connection" ALTER COLUMN "scope" SET DEFAULT '';
--> statement-breakpoint
ALTER TABLE "mail0_connection" ALTER COLUMN "expires_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "mail0_connection_imap" ADD CONSTRAINT "mail0_connection_imap_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;
