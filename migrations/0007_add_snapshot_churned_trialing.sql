ALTER TABLE `semaphore_pay_metric_snapshot` ADD `trialing_subscriptions` integer NOT NULL DEFAULT 0;
ALTER TABLE `semaphore_pay_metric_snapshot` ADD `churned_subscriptions` integer NOT NULL DEFAULT 0;
