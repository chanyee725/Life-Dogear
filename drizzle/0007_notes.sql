CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`source_kind` text,
	`source_title` text,
	`source_url` text,
	`area_id` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notes_archived_idx` ON `notes` (`archived_at`);--> statement-breakpoint
CREATE INDEX `notes_area_idx` ON `notes` (`area_id`);