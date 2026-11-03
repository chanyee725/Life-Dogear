CREATE TABLE `item_stars` (
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`item_type`, `item_id`)
);
