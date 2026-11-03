CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`horizon` text DEFAULT 'quarter' NOT NULL,
	`period` text,
	`area_id` text,
	`parent_id` text,
	`body` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `goals_horizon_idx` ON `goals` (`horizon`,`archived_at`);--> statement-breakpoint
CREATE INDEX `goals_parent_idx` ON `goals` (`parent_id`);--> statement-breakpoint
CREATE TABLE `graph_layout` (
	`node_type` text NOT NULL,
	`node_id` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`node_type`, `node_id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`period` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`focus` text,
	`goal_progress` text,
	`completed_at` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_kind_period_idx` ON `reviews` (`kind`,`period`);--> statement-breakpoint
CREATE INDEX `reviews_archived_idx` ON `reviews` (`archived_at`);--> statement-breakpoint
ALTER TABLE `links` ADD `via` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `goal_id` text REFERENCES goals(id);--> statement-breakpoint
CREATE INDEX `projects_goal_idx` ON `projects` (`goal_id`);