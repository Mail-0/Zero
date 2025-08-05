CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thread_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`label_id` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
