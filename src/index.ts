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
import { runSemaphorePayCron, initSemaphorePay, createSemaphorePayRouter, NombaClient } from '@semaphore-pay/server';
import { captureMetrics } from './services/metrics';

const app = new Hono<HonoEnv>();

// CORS
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin) return '*';
      // In production, restrict to FRONTEND_URL; in dev, allow localhost
      return origin;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Session resolution (Better Auth + query token fallback for Expo deep links)
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
    c.set('user', authSession.user as unknown as HonoEnv['Variables']['user']);
    c.set('session', authSession.session as unknown as HonoEnv['Variables']['session']);
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
let nombaSandbox: any = null;
let nombaLive: any = null;
let nombaCallbackUrl: string = "";

function getOrCreateNombaClients(env: any) {
  if (!nombaCallbackUrl) nombaCallbackUrl = env.NOMBA_CHECKOUT_CALLBACK_URL ?? "";
  if (!nombaSandbox && env.NOMBA_SANDBOX_CLIENT_ID) {
    nombaSandbox = new NombaClient({
      clientId: env.NOMBA_SANDBOX_CLIENT_ID,
      clientSecret: env.NOMBA_SANDBOX_CLIENT_SECRET,
      accountId: env.NOMBA_SANDBOX_ACCOUNT_ID,
      environment: "sandbox",
    });
  }
  if (!nombaLive && env.NOMBA_LIVE_CLIENT_ID) {
    nombaLive = new NombaClient({
      clientId: env.NOMBA_LIVE_CLIENT_ID,
      clientSecret: env.NOMBA_LIVE_CLIENT_SECRET,
      accountId: env.NOMBA_LIVE_ACCOUNT_ID,
      environment: "production",
    });
  }
}

const sdkRouter = createSemaphorePayRouter(sdkEnginePlaceholder, {
  nombaClients: {
    get sandbox() { return nombaSandbox; },
    get production() { return nombaLive; },
    get callbackUrl() { return nombaCallbackUrl; },
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
  getOrCreateNombaClients(c.env);

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

    ctx.waitUntil(
      (async () => {
        // Run existing package cron
        await runSemaphorePayCron(engine);

        // Capture metrics for each collection
        const cols = await db.select({ id: sqliteSchema.collection.id }).from(sqliteSchema.collection);
        for (const col of cols) {
          try {
            await captureMetrics(engine, col.id);
          } catch (err) {
            logger.error('metrics-cron', `Failed to capture metrics for collection ${col.id}`, { error: String(err) });
          }
        }
      })(),
    );
  },
};

export default handler;
