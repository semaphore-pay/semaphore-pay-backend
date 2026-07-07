import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email')
    .notNull()
    .unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  phoneNumber: text('phoneNumber').unique(),
  phoneNumberVerified: integer('phoneNumberVerified', {
    mode: 'boolean',
  }).default(false),
  // Better Auth additional fields
  role: text('role').notNull().default('buyer'),
  username: text('username'),
  businessType: text('businessType').notNull().default('none'),
  profileSetupComplete: integer('profileSetupComplete', { mode: 'boolean' }).notNull().default(false),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token')
    .notNull()
    .unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
});

// ERROR / SYSTEM LOGS TABLE
// Persisted logs only (persist: true on logger calls).
// Retained for 90 days — a separate cron handles cleanup.
export const systemLogs = sqliteTable(
  'system_logs',
  {
    logId: text('log_id').primaryKey(),
    level: text('level', {
      enum: ['debug', 'info', 'warn', 'error'],
    }).notNull(),
    message: text('message').notNull(),
    context: text('context'), // e.g. "user-routes", "purge-worker", "story-expiry"
    userId: text('user_id'), // nullable — not all logs are user-scoped
    meta: text('meta', { mode: 'json' }), // serialized error + extra fields
    retainUntil: integer('retain_until', { mode: 'timestamp' }).notNull(), // createdAt + 90 days
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  table => [
    index('system_logs_level_idx').on(table.level),
    index('system_logs_user_idx').on(table.userId),
    index('system_logs_retain_idx').on(table.retainUntil),
    index('system_logs_created_idx').on(table.createdAt),
  ]
);

export const balance = sqliteTable(
  'semaphore_pay_balance',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id').notNull(),
    available: integer('available').notNull().default(0),
    pending: integer('pending').notNull().default(0),
    totalEarned: integer('total_earned').notNull().default(0),
    platformFeeRate: integer('platform_fee_rate').notNull().default(135),
    currency: text('currency').notNull().default('NGN'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  table => [
    index('semaphore_pay_balance_collection_idx').on(table.collectionId),
  ]
);

export const payout = sqliteTable(
  'semaphore_pay_payout',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id').notNull(),
    amount: integer('amount').notNull(),
    fee: integer('fee').notNull().default(0),
    netAmount: integer('net_amount').notNull(),
    status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
    bankAccountNumber: text('bank_account_number'),
    bankCode: text('bank_code'),
    bankName: text('bank_name'),
    accountName: text('account_name'),
    nombaTransferId: text('nomba_transfer_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  table => [
    index('semaphore_pay_payout_collection_idx').on(table.collectionId),
  ]
);

export const metricSnapshot = sqliteTable(
  'semaphore_pay_metric_snapshot',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id').notNull(),
    date: text('date').notNull(),
    features: integer('features').notNull().default(0),
    booleanFeatures: integer('boolean_features').notNull().default(0),
    limitFeatures: integer('limit_features').notNull().default(0),
    plans: integer('plans').notNull().default(0),
    activePlans: integer('active_plans').notNull().default(0),
    products: integer('products').notNull().default(0),
    customers: integer('customers').notNull().default(0),
    activeSubscriptions: integer('active_subscriptions').notNull().default(0),
    trialingSubscriptions: integer('trialing_subscriptions').notNull().default(0),
    churnedSubscriptions: integer('churned_subscriptions').notNull().default(0),
    mrr: integer('mrr').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  table => [
    index('semaphore_pay_metric_snapshot_collection_date_idx').on(table.collectionId, table.date),
  ]
);
