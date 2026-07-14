import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAuth } from './lib/auth';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt } from 'drizzle-orm';
import { HonoEnv, Env } from './types';
import { session, user } from './db/schema';
import * as sqliteSchema from '@semaphore-pay/server/schema/sqlite';
import { logger } from './lib/logger';
import { BillingRoutes } from './routes/v1/billing';
import { WebhookRoutes } from './routes/v1/webhook';
import {
  runSemaphorePayCron,
  initSemaphorePay,
  createSemaphorePayRouter,
} from '@semaphore-pay/server';
import { buildChargeFn } from '@semaphore-pay/server/nomba/charge-fn';
import { initNombaClients, getNombaClients } from './lib/nomba';
import { captureMetrics } from './services/metrics';

const app = new Hono<HonoEnv>();

app.use(
  '*',
  cors({
    origin: origin => {
      if (!origin) return '*';
      return origin;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  })
);

app.use('*', async (c, next) => {
  const auth = getAuth(c.env);
  const headers = new Headers(c.req.raw.headers);
  const queryToken = c.req.query('token');

  let authSession = await auth.api.getSession({ headers });

  if (!authSession && queryToken) {
    const db = drizzle(c.env.semaphore_db);
    const dbSession = await db
      .select()
      .from(session)
      .where(
        and(eq(session.token, queryToken), gt(session.expiresAt, new Date()))
      )
      .get();

    if (dbSession) {
      const dbUser = await db
        .select()
        .from(user)
        .where(eq(user.id, dbSession.userId))
        .get();

      if (dbUser) {
        authSession = { session: dbSession, user: dbUser };
      }
    }
  }

  if (authSession?.user && authSession?.session) {
    c.set(
      'user',
      (authSession.user as unknown) as HonoEnv['Variables']['user']
    );
    c.set(
      'session',
      (authSession.session as unknown) as HonoEnv['Variables']['session']
    );
  }

  logger.bind(c.env, c.executionCtx);
  return next();
});

// Better Auth passthrough
app.all('/api/auth/*', async c => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Webhook route (no auth required — verified by HMAC)
app.route('/webhook', WebhookRoutes);

// Billing routes (auth required)
app.route('/api/v1/billing', BillingRoutes);

// SDK routes (API key auth — client SDK) mounted at /client
const sdkEnginePlaceholder = initSemaphorePay({
  dialect: 'sqlite',
  db: null as any,
  supportsTransactions: false,
});

// Pre-built Nomba clients — created once per env, cached forever.
// Avoids race condition from shared mutable options.

const sdkRouter = createSemaphorePayRouter(sdkEnginePlaceholder, {
  nombaClients: {
    get sandbox() {
      return getNombaClients().sandbox;
    },
    get production() {
      return getNombaClients().production;
    },
    get callbackUrl() {
      return getNombaClients().callbackUrl;
    },
  },
});

app.use('/client/*', async (c, next) => {
  const engine = initSemaphorePay({
    dialect: 'sqlite',
    db: drizzle(c.env.semaphore_db, { schema: sqliteSchema }),
    supportsTransactions: false,
  });
  (c.env as any)._engine = engine;
  (c.env as any)._semaphorePayDb = engine.db;
  (c.env as any)._semaphorePayApiKeySchema = engine.schema.apiKey;

  // Lazily create Nomba clients from env (first request only)
  initNombaClients(c.env);

  await next();
});

app.route('/client', sdkRouter);

// Static asset passthrough
app.all('*', c => c.env.ASSETS.fetch(c.req.raw));

const handler = {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.semaphore_db, { schema: sqliteSchema });
    const engine = initSemaphorePay({
      dialect: 'sqlite',
      db,
      supportsTransactions: false,
    });

    // Ensure Nomba clients are initialized
    initNombaClients(env);
    const clients = getNombaClients();
    const chargeFn =
      clients.sandbox || clients.production
        ? buildChargeFn(clients, clients.callbackUrl)
        : undefined;

    ctx.waitUntil(
      (async () => {
        // Run existing package cron
        await runSemaphorePayCron(engine, chargeFn);

        // Capture metrics for each collection
        const cols = await db
          .select({ id: sqliteSchema.collection.id })
          .from(sqliteSchema.collection);
        for (const col of cols) {
          try {
            await captureMetrics(engine, col.id);
          } catch (err) {
            logger.error(
              'metrics-cron',
              `Failed to capture metrics for collection ${col.id}`,
              { error: String(err) }
            );
          }
        }
      })()
    );
  },
};

export default handler;
