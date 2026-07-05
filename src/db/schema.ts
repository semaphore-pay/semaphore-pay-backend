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
    index('system_logs_retain_idx').on(table.retainUntil), // for the 90-day cleanup cron
    index('system_logs_created_idx').on(table.createdAt),
  ]
);
