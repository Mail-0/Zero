CREATE TABLE "mail0_writing_style_matrix" (
	"connectionId" text NOT NULL,
	"numMessages" integer NOT NULL,
	"style" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_writing_style_matrix_connectionId_pk" PRIMARY KEY("connectionId")
);
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ALTER COLUMN "settings" SET DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system"}'::jsonb;--> statement-breakpoint
ALTER TABLE "mail0_writing_style_matrix" ADD CONSTRAINT "mail0_writing_style_matrix_connectionId_mail0_connection_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."mail0_connection"("id") ON DELETE no action ON UPDATE no action;