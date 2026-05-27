CREATE TABLE "mail0_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"access_token" text,
	"refresh_token" text,
	"scope" text NOT NULL,
	"provider_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail0_connection_user_id_email_unique" UNIQUE("user_id","email")
);
--> statement-breakpoint
CREATE TABLE "mail0_early_access" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_early_access" boolean DEFAULT false NOT NULL,
	"has_used_ticket" text DEFAULT '',
	CONSTRAINT "mail0_early_access_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mail0_email_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text,
	"to" jsonb,
	"cc" jsonb,
	"bcc" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_email_template_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
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
CREATE TABLE "mail0_oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "mail0_oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "mail0_oauth_access_token_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "mail0_oauth_application" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"icon" text,
	"metadata" text,
	"client_id" text,
	"client_secret" text,
	"redirect_u_r_ls" text,
	"type" text,
	"disabled" boolean,
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "mail0_oauth_application_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "mail0_oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"consent_given" boolean
);
--> statement-breakpoint
CREATE TABLE "mail0_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "mail0_session_token_unique" UNIQUE("token")
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
CREATE TABLE "mail0_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"default_connection_id" text,
	"custom_prompt" text,
	CONSTRAINT "mail0_user_email_unique" UNIQUE("email")
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
	"settings" jsonb DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system","zeroSignature":true,"autoRead":true,"defaultEmailAlias":"","categories":[{"id":"Important","name":"Important","searchValue":"IMPORTANT","order":0,"icon":"Lightning","isDefault":false},{"id":"All Mail","name":"All Mail","searchValue":"","order":1,"icon":"Mail","isDefault":true},{"id":"Unread","name":"Unread","searchValue":"UNREAD","order":5,"icon":"ScanEye","isDefault":false}],"undoSendEnabled":false,"imageCompression":"medium","animations":false}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail0_user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "mail0_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
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
ALTER TABLE "mail0_account" ADD CONSTRAINT "mail0_account_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_email_template" ADD CONSTRAINT "mail0_email_template_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_note" ADD CONSTRAINT "mail0_note_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_session" ADD CONSTRAINT "mail0_session_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_summary" ADD CONSTRAINT "mail0_summary_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_hotkeys" ADD CONSTRAINT "mail0_user_hotkeys_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ADD CONSTRAINT "mail0_user_settings_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_writing_style_matrix" ADD CONSTRAINT "mail0_writing_style_matrix_connectionId_mail0_connection_id_fk" FOREIGN KEY ("connectionId") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "mail0_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_user_id_idx" ON "mail0_account" USING btree ("provider_id","user_id");--> statement-breakpoint
CREATE INDEX "account_expires_at_idx" ON "mail0_account" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX "connection_user_id_idx" ON "mail0_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connection_expires_at_idx" ON "mail0_connection" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "connection_provider_id_idx" ON "mail0_connection" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "early_access_is_early_access_idx" ON "mail0_early_access" USING btree ("is_early_access");--> statement-breakpoint
CREATE INDEX "idx_mail0_email_template_user_id" ON "mail0_email_template" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jwks_created_at_idx" ON "mail0_jwks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "note_user_id_idx" ON "mail0_note" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_thread_id_idx" ON "mail0_note" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "note_user_thread_idx" ON "mail0_note" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE INDEX "note_is_pinned_idx" ON "mail0_note" USING btree ("is_pinned");--> statement-breakpoint
CREATE INDEX "oauth_access_token_user_id_idx" ON "mail0_oauth_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_client_id_idx" ON "mail0_oauth_access_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_access_token_expires_at_idx" ON "mail0_oauth_access_token" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX "oauth_application_user_id_idx" ON "mail0_oauth_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_application_disabled_idx" ON "mail0_oauth_application" USING btree ("disabled");--> statement-breakpoint
CREATE INDEX "oauth_consent_user_id_idx" ON "mail0_oauth_consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_client_id_idx" ON "mail0_oauth_consent" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_given_idx" ON "mail0_oauth_consent" USING btree ("consent_given");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "mail0_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "mail0_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "summary_connection_id_idx" ON "mail0_summary" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "summary_connection_id_saved_idx" ON "mail0_summary" USING btree ("connection_id","saved");--> statement-breakpoint
CREATE INDEX "summary_saved_idx" ON "mail0_summary" USING btree ("saved");--> statement-breakpoint
CREATE INDEX "user_hotkeys_shortcuts_idx" ON "mail0_user_hotkeys" USING btree ("shortcuts");--> statement-breakpoint
CREATE INDEX "user_settings_settings_idx" ON "mail0_user_settings" USING btree ("settings");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "mail0_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verification_expires_at_idx" ON "mail0_verification" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "writing_style_matrix_style_idx" ON "mail0_writing_style_matrix" USING btree ("style");