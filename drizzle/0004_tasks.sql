CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`done_at` text,
	`due_date` text,
	`parent_type` text,
	`parent_id` text,
	`sort_order` integer NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_type`,`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`done_at`,`due_date`);