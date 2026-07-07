CREATE TABLE IF NOT EXISTS `semaphore_pay_balance` (
  `id` text PRIMARY KEY,
  `collection_id` text NOT NULL,
  `available` integer NOT NULL DEFAULT 0,
  `pending` integer NOT NULL DEFAULT 0,
  `total_earned` integer NOT NULL DEFAULT 0,
  `platform_fee_rate` integer NOT NULL DEFAULT 135,
  `currency` text NOT NULL DEFAULT 'NGN',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `semaphore_pay_balance_collection_idx` ON `semaphore_pay_balance` (`collection_id`);

CREATE TABLE IF NOT EXISTS `semaphore_pay_payout` (
  `id` text PRIMARY KEY,
  `collection_id` text NOT NULL,
  `amount` integer NOT NULL,
  `fee` integer NOT NULL DEFAULT 0,
  `net_amount` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `bank_account_number` text,
  `bank_code` text,
  `bank_name` text,
  `account_name` text,
  `nomba_transfer_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `semaphore_pay_payout_collection_idx` ON `semaphore_pay_payout` (`collection_id`);
