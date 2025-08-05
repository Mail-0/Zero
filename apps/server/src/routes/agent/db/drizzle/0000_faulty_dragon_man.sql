CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `labels_name_idx` ON `labels` (`name`);--> statement-breakpoint
CREATE TABLE `thread_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`label_id` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_labels_thread_id_idx` ON `thread_labels` (`thread_id`);--> statement-breakpoint
CREATE INDEX `thread_labels_label_id_idx` ON `thread_labels` (`label_id`);--> statement-breakpoint
CREATE INDEX `thread_labels_thread_label_idx` ON `thread_labels` (`thread_id`,`label_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `thread_labels_thread_id_label_id_unique` ON `thread_labels` (`thread_id`,`label_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`latest_sender` text,
	`latest_received_on` text,
	`latest_subject` text,
	`latest_label_ids` text
);
--> statement-breakpoint
CREATE INDEX `threads_thread_id_idx` ON `threads` (`thread_id`);--> statement-breakpoint
CREATE INDEX `threads_provider_id_idx` ON `threads` (`provider_id`);--> statement-breakpoint
CREATE INDEX `threads_latest_received_on_idx` ON `threads` (`latest_received_on`);--> statement-breakpoint
CREATE INDEX `threads_latest_subject_idx` ON `threads` (`latest_subject`);--> statement-breakpoint
CREATE INDEX `threads_latest_sender_idx` ON `threads` (`latest_sender`);