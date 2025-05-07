CREATE TABLE "mail0_connection_theme" (
	"connection_id" text NOT NULL,
	"theme_id" text NOT NULL,
	CONSTRAINT "mail0_connection_theme_connection_id_theme_id_pk" PRIMARY KEY("connection_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "mail0_theme" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"style" json NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"user_id" text NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ALTER COLUMN "settings" SET DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system"}'::jsonb;--> statement-breakpoint
ALTER TABLE "mail0_connection_theme" ADD CONSTRAINT "mail0_connection_theme_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_connection_theme" ADD CONSTRAINT "mail0_connection_theme_theme_id_mail0_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."mail0_theme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_theme" ADD CONSTRAINT "mail0_theme_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;