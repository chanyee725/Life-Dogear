CREATE TABLE `learning_roadmaps` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_roadmaps_slug_unique` ON `learning_roadmaps` (`slug`);--> statement-breakpoint
CREATE TABLE `roadmap_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`roadmap_id` text NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priority` text,
	`resources` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`roadmap_id`) REFERENCES `learning_roadmaps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `roadmap_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roadmap_nodes_roadmap_idx` ON `roadmap_nodes` (`roadmap_id`,`parent_id`,`position`);--> statement-breakpoint
CREATE INDEX `roadmap_nodes_parent_idx` ON `roadmap_nodes` (`parent_id`);