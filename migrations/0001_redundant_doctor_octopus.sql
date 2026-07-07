CREATE TABLE `semaphore_pay_api_key` (
	`key` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`type` text NOT NULL,
	`environment` text DEFAULT 'development' NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_api_key_collection_idx` ON `semaphore_pay_api_key` (`collection_id`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_api_key_user_idx` ON `semaphore_pay_api_key` (`user_id`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_collection` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `semaphore_pay_customer` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`email` text,
	`name` text,
	`metadata` text,
	`nomba_customer_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_customer_user_idx` ON `semaphore_pay_customer` (`user_id`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_customer_nomba_idx` ON `semaphore_pay_customer` (`nomba_customer_id`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_entitlement` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text,
	`product_purchase_id` text,
	`customer_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`limit` integer,
	`balance` integer,
	`next_reset_at` integer,
	`source_type` text DEFAULT 'subscription' NOT NULL,
	`source_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `semaphore_pay_subscription`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_purchase_id`) REFERENCES `semaphore_pay_product_purchase`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `semaphore_pay_customer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `semaphore_pay_feature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_entitlement_customer_feature_idx` ON `semaphore_pay_entitlement` (`customer_id`,`feature_id`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_entitlement_source_idx` ON `semaphore_pay_entitlement` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_feature` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `semaphore_pay_invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`subscription_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`nomba_transaction_id` text,
	`nomba_payment_method_id` text,
	`period_start_at` integer,
	`period_end_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `semaphore_pay_customer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `semaphore_pay_subscription`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_invoice_customer_idx` ON `semaphore_pay_invoice` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_invoice_nomba_transaction_idx` ON `semaphore_pay_invoice` (`nomba_transaction_id`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_payment_method` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`nomba_token_id` text NOT NULL,
	`type` text,
	`brand` text,
	`last4` text,
	`expiry_month` integer,
	`expiry_year` integer,
	`is_default` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `semaphore_pay_customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_payment_method_customer_idx` ON `semaphore_pay_payment_method` (`customer_id`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_payment_method_nomba_idx` ON `semaphore_pay_payment_method` (`nomba_token_id`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`environment` text DEFAULT 'development' NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_amount` integer NOT NULL,
	`price_currency` text DEFAULT 'NGN',
	`interval` text NOT NULL,
	`trial_period_days` integer DEFAULT 30 NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`badge` text,
	`cta_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_plan_collection_env_idx` ON `semaphore_pay_plan` (`collection_id`,`environment`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_plan_active_idx` ON `semaphore_pay_plan` (`is_active`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_plan_feature` (
	`plan_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`limit` integer,
	`reset_interval` text,
	`config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`plan_id`, `feature_id`),
	FOREIGN KEY (`plan_id`) REFERENCES `semaphore_pay_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `semaphore_pay_feature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `semaphore_pay_product` (
	`internal_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`collection_id` text NOT NULL,
	`environment` text DEFAULT 'development' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`group` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`price_amount` integer,
	`price_currency` text DEFAULT 'NGN',
	`price_interval` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `semaphore_pay_product_id_version_unique` ON `semaphore_pay_product` (`id`,`version`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_product_collection_env_idx` ON `semaphore_pay_product` (`collection_id`,`environment`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_product_feature` (
	`product_internal_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`limit` integer,
	`reset_interval` text,
	`config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`product_internal_id`, `feature_id`),
	FOREIGN KEY (`product_internal_id`) REFERENCES `semaphore_pay_product`(`internal_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `semaphore_pay_feature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `semaphore_pay_product_purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`product_internal_id` text NOT NULL,
	`nomba_order_reference` text,
	`status` text NOT NULL,
	`purchased_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `semaphore_pay_customer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_internal_id`) REFERENCES `semaphore_pay_product`(`internal_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_product_purchase_customer_idx` ON `semaphore_pay_product_purchase` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_product_purchase_nomba_idx` ON `semaphore_pay_product_purchase` (`nomba_order_reference`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`product_internal_id` text,
	`nomba_order_reference` text,
	`status` text NOT NULL,
	`canceled` integer DEFAULT false NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`started_at` integer,
	`current_period_start_at` integer,
	`current_period_end_at` integer,
	`trial_end_at` integer,
	`next_retry_at` integer,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_retry_at` integer,
	`canceled_at` integer,
	`ended_at` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `semaphore_pay_customer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `semaphore_pay_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_internal_id`) REFERENCES `semaphore_pay_product`(`internal_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `semaphore_pay_subscription_customer_status_idx` ON `semaphore_pay_subscription` (`collection_id`,`customer_id`,`status`,`ended_at`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_subscription_next_retry_idx` ON `semaphore_pay_subscription` (`next_retry_at`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_subscription_plan_idx` ON `semaphore_pay_subscription` (`plan_id`);--> statement-breakpoint
CREATE TABLE `semaphore_pay_webhook_event` (
	`id` text PRIMARY KEY NOT NULL,
	`nomba_event_id` text NOT NULL,
	`collection_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`collection_id`) REFERENCES `semaphore_pay_collection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `semaphore_pay_webhook_event_nomba_event_id_unique` ON `semaphore_pay_webhook_event` (`nomba_event_id`);--> statement-breakpoint
CREATE INDEX `semaphore_pay_webhook_event_status_idx` ON `semaphore_pay_webhook_event` (`status`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'buyer' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `businessType` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `profileSetupComplete` integer DEFAULT false NOT NULL;