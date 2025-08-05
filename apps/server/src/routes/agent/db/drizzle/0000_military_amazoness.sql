CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`thread_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`latestSender` text,
	`latest_received_on` text,
	`latest_subject` text,
	`latestLabelIds` text
);
