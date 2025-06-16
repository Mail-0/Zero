CREATE TABLE "mail0_jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_note" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"content" text NOT NULL,
	"color" text DEFAULT 'default' NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_summary" (
	"message_id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"connection_id" text NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"tags" text,
	"suggested_reply" text
);
--> statement-breakpoint
CREATE TABLE "mail0_user_hotkeys" (
	"user_id" text PRIMARY KEY NOT NULL,
	"shortcuts" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"settings" jsonb DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system","zeroSignature":true}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail0_user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "mail0_writing_style_matrix" (
	"connectionId" text NOT NULL,
	"numMessages" integer NOT NULL,
	"style" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_writing_style_matrix_connectionId_pk" PRIMARY KEY("connectionId")
);
--> statement-breakpoint
ALTER TABLE "mail0_connection" DROP CONSTRAINT "mail0_connection_email_unique";--> statement-breakpoint
ALTER TABLE "mail0_user_favorite_themes" DROP CONSTRAINT "mail0_user_favorite_themes_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_favorite_themes" DROP CONSTRAINT "mail0_user_favorite_themes_theme_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_favorite_themes" DROP CONSTRAINT "mail0_user_favorite_themes_pk";--> statement-breakpoint
ALTER TABLE "mail0_connection" ALTER COLUMN "access_token" DROP NOT NULL;--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'mail0_user_favorite_themes'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "mail0_user_favorite_themes" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "mail0_user_favorite_themes" ADD CONSTRAINT "mail0_user_favorite_themes_user_id_theme_id_pk" PRIMARY KEY("user_id","theme_id");--> statement-breakpoint
ALTER TABLE "mail0_early_access" ADD COLUMN "is_early_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mail0_early_access" ADD COLUMN "has_used_ticket" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "mail0_user" ADD COLUMN "custom_prompt" text;--> statement-breakpoint
ALTER TABLE "mail0_user" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "mail0_user" ADD COLUMN "phone_number_verified" boolean;--> statement-breakpoint
ALTER TABLE "mail0_note" ADD CONSTRAINT "mail0_note_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_hotkeys" ADD CONSTRAINT "mail0_user_hotkeys_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ADD CONSTRAINT "mail0_user_settings_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_writing_style_matrix" ADD CONSTRAINT "mail0_writing_style_matrix_connectionId_mail0_connection_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_favorite_themes" ADD CONSTRAINT "mail0_user_favorite_themes_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_favorite_themes" ADD CONSTRAINT "mail0_user_favorite_themes_theme_id_mail0_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."mail0_theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_theme" DROP COLUMN "backgrounds";--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_user_id_email_unique" UNIQUE("user_id","email");--> statement-breakpoint
ALTER TABLE "mail0_user" ADD CONSTRAINT "mail0_user_phone_number_unique" UNIQUE("phone_number");