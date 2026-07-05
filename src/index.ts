import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAuth } from './lib/auth';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt } from 'drizzle-orm';
import { HonoEnv, Env } from './types';
import { session, user } from './db/schema';
import { logger } from './lib/logger';
import { BillingRoutes } from './routes/v1/billing';
import { WebhookRoutes } from './routes/v1/webhook';
import { runSemaphorePayCron, initSemaphorePay } from '@semaphore-pay/server';

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

// Static asset passthrough
app.all('*', c => c.env.ASSETS.fetch(c.req.raw));

const handler = {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.semaphore_db);
    const engine = initSemaphorePay({
      dialect: 'sqlite',
      db,
      supportsTransactions: false,
    });

    ctx.waitUntil(runSemaphorePayCron(engine));
  },
};

export default handler;
