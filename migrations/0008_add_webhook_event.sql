CREATE TABLE IF NOT EXISTS `semaphore_pay_webhook_event` (
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
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `semaphore_pay_webhook_event_nomba_event_id_unique` ON `semaphore_pay_webhook_event` (`nomba_event_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `semaphore_pay_webhook_event_status_idx` ON `semaphore_pay_webhook_event` (`status`);
