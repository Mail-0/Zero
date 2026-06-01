CREATE TABLE "action_item" (
	"action_item_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_suggestion" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"email_id" text NOT NULL,
	"action_item_id" text,
	"action_label" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "analysis_result" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_id" text NOT NULL,
	"category_id" text,
	"category" text,
	"priority_score" double precision,
	"suggested_actions" text,
	"reason" text,
	"source" text DEFAULT 'llm' NOT NULL,
	"raw_result" jsonb,
	"hallucination_checked" boolean DEFAULT false NOT NULL,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"category_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_name" text NOT NULL,
	"prompt_hint" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction_record" (
	"correction_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_id" text NOT NULL,
	"corrected_category_id" text,
	"corrected_category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email" (
	"email_id" text PRIMARY KEY NOT NULL,
	"date" timestamp,
	"from" text,
	"sender" text,
	"receiver" text,
	"reply_to" text,
	"to" text,
	"cc" text,
	"bcc" text,
	"subject" text,
	"body" text,
	"message_id" text,
	"in_reply_to" text,
	"mailbox_id" text NOT NULL,
	"category_id" text,
	"priority_score" double precision,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_data" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"analysis_id" text,
	"email_id" text NOT NULL,
	"target_type" text NOT NULL,
	"rating" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hallucination_mitigation_log" (
	"task_id" text PRIMARY KEY NOT NULL,
	"analysis_id" text,
	"email_id" text NOT NULL,
	"raw_output" jsonb,
	"status" text NOT NULL,
	"corrected_output" jsonb,
	"reprocess_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailbox" (
	"mailbox_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mailbox_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mime_content" (
	"id" text PRIMARY KEY NOT NULL,
	"email_id" text NOT NULL,
	"content_type" text,
	"charset" text,
	"transfer_encoding" text,
	"disposition" text,
	"filename" text,
	"content_id" text,
	"raw_payload" text,
	"decoded_text" text
);
--> statement-breakpoint
CREATE TABLE "priority_score" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"email_id" text NOT NULL,
	"score" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_context" (
	"prompt_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt_data" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"user_type" text DEFAULT '' NOT NULL,
	"occupation" text DEFAULT '' NOT NULL,
	"affiliation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"important_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_suggestion" ADD CONSTRAINT "action_suggestion_analysis_id_analysis_result_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_suggestion" ADD CONSTRAINT "action_suggestion_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_suggestion" ADD CONSTRAINT "action_suggestion_action_item_id_action_item_action_item_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_item"("action_item_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_result" ADD CONSTRAINT "analysis_result_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_result" ADD CONSTRAINT "analysis_result_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_result" ADD CONSTRAINT "analysis_result_category_id_category_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("category_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_record" ADD CONSTRAINT "correction_record_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_record" ADD CONSTRAINT "correction_record_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_record" ADD CONSTRAINT "correction_record_corrected_category_id_category_category_id_fk" FOREIGN KEY ("corrected_category_id") REFERENCES "public"."category"("category_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email" ADD CONSTRAINT "email_mailbox_id_mailbox_mailbox_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailbox"("mailbox_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email" ADD CONSTRAINT "email_category_id_category_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("category_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_data" ADD CONSTRAINT "feedback_data_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_data" ADD CONSTRAINT "feedback_data_analysis_id_analysis_result_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_data" ADD CONSTRAINT "feedback_data_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hallucination_mitigation_log" ADD CONSTRAINT "hallucination_mitigation_log_analysis_id_analysis_result_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hallucination_mitigation_log" ADD CONSTRAINT "hallucination_mitigation_log_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox" ADD CONSTRAINT "mailbox_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mime_content" ADD CONSTRAINT "mime_content_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_score" ADD CONSTRAINT "priority_score_analysis_id_analysis_result_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_score" ADD CONSTRAINT "priority_score_email_id_email_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("email_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_context" ADD CONSTRAINT "prompt_context_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_item_user_id_idx" ON "action_item" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "action_item_enabled_idx" ON "action_item" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "action_suggestion_analysis_id_idx" ON "action_suggestion" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "action_suggestion_email_id_idx" ON "action_suggestion" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "action_suggestion_action_item_id_idx" ON "action_suggestion" USING btree ("action_item_id");--> statement-breakpoint
CREATE INDEX "analysis_result_user_id_idx" ON "analysis_result" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analysis_result_email_id_idx" ON "analysis_result" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "analysis_result_category_id_idx" ON "analysis_result" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "analysis_result_source_idx" ON "analysis_result" USING btree ("source");--> statement-breakpoint
CREATE INDEX "category_user_id_idx" ON "category" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "category_enabled_idx" ON "category" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "correction_record_user_id_idx" ON "correction_record" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "correction_record_email_id_idx" ON "correction_record" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "correction_record_corrected_category_id_idx" ON "correction_record" USING btree ("corrected_category_id");--> statement-breakpoint
CREATE INDEX "email_mailbox_id_idx" ON "email" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "email_message_id_idx" ON "email" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_category_id_idx" ON "email" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "feedback_data_user_id_idx" ON "feedback_data" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_data_analysis_id_idx" ON "feedback_data" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "feedback_data_email_id_idx" ON "feedback_data" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "feedback_data_target_type_idx" ON "feedback_data" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "hallucination_mitigation_log_analysis_id_idx" ON "hallucination_mitigation_log" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "hallucination_mitigation_log_email_id_idx" ON "hallucination_mitigation_log" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "hallucination_mitigation_log_status_idx" ON "hallucination_mitigation_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mailbox_user_id_idx" ON "mailbox" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mime_content_email_id_idx" ON "mime_content" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "mime_content_content_id_idx" ON "mime_content" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "mime_content_filename_idx" ON "mime_content" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "priority_score_analysis_id_idx" ON "priority_score" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "priority_score_email_id_idx" ON "priority_score" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "prompt_context_user_id_idx" ON "prompt_context" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prompt_context_active_idx" ON "prompt_context" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_profile_user_id_idx" ON "user_profile" USING btree ("user_id");