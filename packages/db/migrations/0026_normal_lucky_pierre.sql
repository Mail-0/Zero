CREATE TABLE "mail0_theme" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"styles" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_theme_connection_map" (
	"id" text PRIMARY KEY NOT NULL,
	"theme_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_visible_on_marketplace" boolean DEFAULT false,
	CONSTRAINT "mail0_theme_connection_map_theme_id_connection_id_unique" UNIQUE("theme_id","connection_id")
);
--> statement-breakpoint
ALTER TABLE "mail0_theme" ADD CONSTRAINT "mail0_theme_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_theme_connection_map" ADD CONSTRAINT "mail0_theme_connection_map_theme_id_mail0_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."mail0_theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_theme_connection_map" ADD CONSTRAINT "mail0_theme_connection_map_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;