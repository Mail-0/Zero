ALTER TABLE `threads` ADD `latest_sender` text;--> statement-breakpoint
ALTER TABLE `threads` ADD `latest_label_ids` text;--> statement-breakpoint
ALTER TABLE `threads` DROP COLUMN `latestSender`;--> statement-breakpoint
ALTER TABLE `threads` DROP COLUMN `latestLabelIds`;