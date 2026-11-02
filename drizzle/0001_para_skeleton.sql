CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`standard` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `areas_order_idx` ON `areas` (`archived_at`,`sort_order`);--> statement-breakpoint
ALTER TABLE `papers` ADD `archived_at` text;--> statement-breakpoint
CREATE INDEX `papers_archived_idx` ON `papers` (`archived_at`);--> statement-breakpoint
ALTER TABLE `projects` ADD `kind` text DEFAULT 'research' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `area_id` text REFERENCES areas(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `projects` ADD `next_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `archived_at` text;--> statement-breakpoint
CREATE INDEX `projects_kind_status_idx` ON `projects` (`kind`,`status`,`archived_at`);--> statement-breakpoint
CREATE INDEX `projects_area_idx` ON `projects` (`area_id`);--> statement-breakpoint
ALTER TABLE `seminars` ADD `archived_at` text;--> statement-breakpoint
CREATE INDEX `seminars_archived_idx` ON `seminars` (`archived_at`);--> statement-breakpoint
ALTER TABLE `thoughts` ADD `archived_at` text;--> statement-breakpoint
CREATE INDEX `thoughts_archived_idx` ON `thoughts` (`archived_at`);--> statement-breakpoint
-- Backfill: submitted research projects are done.
UPDATE `projects` SET `status` = 'done', `completed_at` = `updated_at` WHERE `stage` = 'submitted';
