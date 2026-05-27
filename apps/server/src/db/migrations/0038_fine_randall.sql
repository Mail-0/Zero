ALTER TABLE "mail0_account" DROP CONSTRAINT "mail0_account_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_connection" DROP CONSTRAINT "mail0_connection_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_session" DROP CONSTRAINT "mail0_session_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_hotkeys" DROP CONSTRAINT "mail0_user_hotkeys_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" DROP CONSTRAINT "mail0_user_settings_user_id_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_summary" DROP CONSTRAINT "mail0_summary_connection_id_mail0_connection_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ALTER COLUMN "settings" SET DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system","zeroSignature":true,"autoRead":true,"defaultEmailAlias":"","categories":[{"id":"Important","name":"Important","searchValue":"IMPORTANT","order":0,"icon":"Lightning","isDefault":false},{"id":"All Mail","name":"All Mail","searchValue":"","order":1,"icon":"Mail","isDefault":true},{"id":"Unread","name":"Unread","searchValue":"UNREAD","order":5,"icon":"ScanEye","isDefault":false}],"undoSendEnabled":false,"imageCompression":"medium","animations":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "mail0_account" ADD CONSTRAINT "mail0_account_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_connection" ADD CONSTRAINT "mail0_connection_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_session" ADD CONSTRAINT "mail0_session_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_summary" ADD CONSTRAINT "mail0_summary_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_hotkeys" ADD CONSTRAINT "mail0_user_hotkeys_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ADD CONSTRAINT "mail0_user_settings_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "mail0_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_provider_user_id_idx" ON "mail0_account" USING btree ("provider_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_expires_at_idx" ON "mail0_account" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connection_user_id_idx" ON "mail0_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connection_expires_at_idx" ON "mail0_connection" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connection_provider_id_idx" ON "mail0_connection" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "early_access_is_early_access_idx" ON "mail0_early_access" USING btree ("is_early_access");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jwks_created_at_idx" ON "mail0_jwks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_user_id_idx" ON "mail0_note" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_thread_id_idx" ON "mail0_note" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_user_thread_idx" ON "mail0_note" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_is_pinned_idx" ON "mail0_note" USING btree ("is_pinned");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_access_token_user_id_idx" ON "mail0_oauth_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_access_token_client_id_idx" ON "mail0_oauth_access_token" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_access_token_expires_at_idx" ON "mail0_oauth_access_token" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_application_user_id_idx" ON "mail0_oauth_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_application_disabled_idx" ON "mail0_oauth_application" USING btree ("disabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_consent_user_id_idx" ON "mail0_oauth_consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_consent_client_id_idx" ON "mail0_oauth_consent" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_consent_given_idx" ON "mail0_oauth_consent" USING btree ("consent_given");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "mail0_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_expires_at_idx" ON "mail0_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "summary_connection_id_idx" ON "mail0_summary" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "summary_connection_id_saved_idx" ON "mail0_summary" USING btree ("connection_id","saved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "summary_saved_idx" ON "mail0_summary" USING btree ("saved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_hotkeys_shortcuts_idx" ON "mail0_user_hotkeys" USING btree ("shortcuts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_settings_settings_idx" ON "mail0_user_settings" USING btree ("settings");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "mail0_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_expires_at_idx" ON "mail0_verification" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "writing_style_matrix_style_idx" ON "mail0_writing_style_matrix" USING btree ("style");