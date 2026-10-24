CREATE TABLE "mail0_assistant_action" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"tool" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_assistant_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_assistant_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"gateway" text NOT NULL,
	"sender" text NOT NULL,
	"user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_identity_sender" UNIQUE("channel","gateway","sender")
);
--> statement-breakpoint
CREATE TABLE "mail0_assistant_link" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"gateway" text NOT NULL,
	"sender" text NOT NULL,
	"user_id" text,
	"challenge" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail0_assistant_action" ADD CONSTRAINT "mail0_assistant_action_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_assistant_action" ADD CONSTRAINT "mail0_assistant_action_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_assistant_conversation" ADD CONSTRAINT "mail0_assistant_conversation_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_assistant_identity" ADD CONSTRAINT "mail0_assistant_identity_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_assistant_link" ADD CONSTRAINT "mail0_assistant_link_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_action_user" ON "mail0_assistant_action" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assistant_conversation_user" ON "mail0_assistant_conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assistant_identity_user" ON "mail0_assistant_identity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assistant_link_sender" ON "mail0_assistant_link" USING btree ("channel","gateway","sender");