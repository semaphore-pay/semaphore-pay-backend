CREATE TABLE `semaphore_pay_metric_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`date` text NOT NULL,
	`features` integer NOT NULL DEFAULT 0,
	`boolean_features` integer NOT NULL DEFAULT 0,
	`limit_features` integer NOT NULL DEFAULT 0,
	`plans` integer NOT NULL DEFAULT 0,
	`active_plans` integer NOT NULL DEFAULT 0,
	`products` integer NOT NULL DEFAULT 0,
	`customers` integer NOT NULL DEFAULT 0,
	`active_subscriptions` integer NOT NULL DEFAULT 0,
	`mrr` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_metric_snapshot_collection_date_idx` ON `semaphore_pay_metric_snapshot` (`collection_id`,`date`);