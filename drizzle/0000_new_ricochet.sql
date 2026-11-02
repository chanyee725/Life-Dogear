CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`page` integer NOT NULL,
	`text` text NOT NULL,
	`color` text DEFAULT 'yellow' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`rects` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `highlights_paper_idx` ON `highlights` (`paper_id`,`page`);--> statement-breakpoint
CREATE TABLE `item_tags` (
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`item_type`, `item_id`, `tag_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_tags_tag_idx` ON `item_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_pair_idx` ON `links` (`source_type`,`source_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `links_target_idx` ON `links` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `papers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`authors` text DEFAULT '[]' NOT NULL,
	`year` integer,
	`venue` text DEFAULT '' NOT NULL,
	`doi` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`pdf_path` text,
	`read_status` text DEFAULT 'to_read' NOT NULL,
	`importance` text DEFAULT 'reference' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`last_page` integer,
	`last_scroll` real,
	`total_pages` integer,
	`last_read_at` text,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `papers_continue_reading_idx` ON `papers` (`read_status`,`last_read_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`research_question` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'exploring' NOT NULL,
	`start_date` text,
	`due_date` text,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seminars` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text,
	`speaker` text DEFAULT '' NOT NULL,
	`host_venue` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'seminar' NOT NULL,
	`key_line` text DEFAULT '' NOT NULL,
	`material_url` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_nocase_idx` ON `tags` (lower("name"));--> statement-breakpoint
CREATE TABLE `thoughts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'memo' NOT NULL,
	`maturity` text DEFAULT 'seed' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
