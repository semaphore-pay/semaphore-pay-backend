import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import {
  initSemaphorePay,
  createCollection,
  createApiKey,
  createProduct,
  listProducts,
  create,
  list,
  get,
  subscribe,
  cancel,
  check,
  report,
  upsertCustomer,
  getCustomer,
} from '@semaphore-pay/server';
import {
  get as getSubscription,
  list as listSubscriptionsApi,
  pause as pauseSubscription,
  resume as resumeSubscription,
  reactivate as reactivateSubscription,
} from '@semaphore-pay/server/subscription';
import type { SemaphorePayEngine } from '@semaphore-pay/server';
import * as sqliteSchema from '@semaphore-pay/server/schema/sqlite';
import { requireAuth } from '../../lib/auth';
import { checkQuota } from '../../services/quotas';
import { getCollectionStats, getCollectionAnalytics } from '../../services/analytics';
import { logger } from '../../lib/logger';
import {
  zValidator,
  createCollectionSchema,
  createPlanSchema,
  createProductSchema,
  upsertCustomerSchema,
  subscribeSchema,
  checkEntitlementSchema,
  reportEntitlementSchema,
} from '../../lib/validators';
import type { HonoEnv } from '../../types';

const billing = new Hono<HonoEnv>();

function getEngine(env: HonoEnv['Bindings']): SemaphorePayEngine<'sqlite'> {
  const db = drizzle(env.semaphore_db);
  return initSemaphorePay({ dialect: 'sqlite', db, supportsTransactions: false });
}

// Auth middleware — sets user/session in context
billing.use('*', async (c, next) => {
  const result = requireAuth(c);
  if (result instanceof Response) return result;
  return next();
});

// ==================== COLLECTIONS ====================

billing.post('/collections', zValidator('json', createCollectionSchema), async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const engine = getEngine(c.env);
  const body = c.req.valid('json');

  const quota = await checkQuota(engine, user.id, 'collections');
  if (!quota.allowed) {
    return c.json({ error: 'Collection limit reached.', quota }, 403);
  }

  const collection = await createCollection(engine, body.name);
  const publicKey = await createApiKey(engine, {
    collectionId: collection.id,
    type: 'public',
    environment: 'development',
    userId: user.id,
  });
  const secretKey = await createApiKey(engine, {
    collectionId: collection.id,
    type: 'secret',
    environment: 'development',
  });

  logger.info('Collection created', {
    context: 'billing',
    userId: user.id,
    meta: { collectionId: collection.id, name: body.name },
  });

  return c.json({ collection, keys: { public: publicKey.key, secret: secretKey.key } });
});

billing.get('/collections', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const db = drizzle(c.env.semaphore_db);

  const keys = await db
    .select()
    .from(sqliteSchema.apiKey)
    .where(eq(sqliteSchema.apiKey.userId, user.id));

  const collectionIds = [...new Set(keys.map((k) => k.collectionId))];
  const collections = [];

  for (const id of collectionIds) {
    const col = await db
      .select()
      .from(sqliteSchema.collection)
      .where(eq(sqliteSchema.collection.id, id))
      .get();

    if (col) {
      const engine = getEngine(c.env);
      const stats = await getCollectionStats(engine, id);
      collections.push({ ...col, ...stats });
    }
  }

  return c.json(collections);
});

billing.get('/collections/:id', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const db = drizzle(c.env.semaphore_db);
  const collectionId = c.req.param('id');

  const key = await db
    .select()
    .from(sqliteSchema.apiKey)
    .where(
      and(
        eq(sqliteSchema.apiKey.collectionId, collectionId),
        eq(sqliteSchema.apiKey.userId, user.id)
      )
    )
    .get();

  if (!key) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const col = await db
    .select()
    .from(sqliteSchema.collection)
    .where(eq(sqliteSchema.collection.id, collectionId))
    .get();

  const engine = getEngine(c.env);
  const stats = await getCollectionStats(engine, collectionId);
  return c.json({ ...col, ...stats });
});

billing.get('/collections/:id/analytics', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const db = drizzle(c.env.semaphore_db);
  const collectionId = c.req.param('id');

  const key = await db
    .select()
    .from(sqliteSchema.apiKey)
    .where(
      and(
        eq(sqliteSchema.apiKey.collectionId, collectionId),
        eq(sqliteSchema.apiKey.userId, user.id)
      )
    )
    .get();

  if (!key) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const engine = getEngine(c.env);
  const analytics = await getCollectionAnalytics(engine, collectionId);
  return c.json(analytics);
});

billing.delete('/collections/:id', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const db = drizzle(c.env.semaphore_db);
  const collectionId = c.req.param('id');

  const key = await db
    .select()
    .from(sqliteSchema.apiKey)
    .where(
      and(
        eq(sqliteSchema.apiKey.collectionId, collectionId),
        eq(sqliteSchema.apiKey.userId, user.id)
      )
    )
    .get();

  if (!key) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  await db
    .delete(sqliteSchema.apiKey)
    .where(eq(sqliteSchema.apiKey.collectionId, collectionId));

  return c.json({ success: true });
});

// ==================== PLANS ====================

billing.post(
  '/collections/:collectionId/plans',
  zValidator('json', createPlanSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const quota = await checkQuota(engine, collectionId, 'plans');
    if (!quota.allowed) {
      return c.json({ error: 'Plan limit reached.', quota }, 403);
    }

    const result = await create(engine, body, {
      collectionId,
      environment: 'development',
    });

    return c.json(result);
  }
);

billing.get('/collections/:collectionId/plans', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');

  const result = await list(engine, {}, { collectionId, environment: 'development' });
  return c.json(result);
});

billing.get('/collections/:collectionId/plans/:planId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const planId = c.req.param('planId');

  const result = await get(engine, { planId }, { collectionId, environment: 'development' });
  return c.json(result ?? null);
});

// ==================== PRODUCTS ====================

billing.post(
  '/collections/:collectionId/products',
  zValidator('json', createProductSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const result = await createProduct(engine, {
      ...body,
      collectionId,
      environment: 'development',
    });

    return c.json(result);
  }
);

billing.get('/collections/:collectionId/products', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');

  const result = await listProducts(engine, { collectionId, environment: 'development' });
  return c.json(result);
});

// ==================== CUSTOMERS ====================

billing.post(
  '/collections/:collectionId/customers',
  zValidator('json', upsertCustomerSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const result = await upsertCustomer(engine, body, { collectionId });
    return c.json(result);
  }
);

billing.get('/collections/:collectionId/customers/:customerId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const customerId = c.req.param('customerId');

  const result = await getCustomer(engine, { customerId }, { collectionId });
  return c.json(result ?? null);
});

// ==================== SUBSCRIPTIONS ====================

billing.post(
  '/collections/:collectionId/subscriptions/subscribe',
  zValidator('json', subscribeSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const result = await subscribe(engine, body, {
      collectionId,
      environment: 'development',
    });

    return c.json(result);
  }
);

billing.post('/collections/:collectionId/subscriptions/:subscriptionId/cancel', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const subscriptionId = c.req.param('subscriptionId');

  const result = await cancel(engine, subscriptionId, { collectionId });
  return c.json(result);
});

billing.get('/collections/:collectionId/subscriptions', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const status = c.req.query('status') ?? undefined;
  const planId = c.req.query('planId') ?? undefined;
  const customerId = c.req.query('customerId') ?? undefined;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

  const result = await listSubscriptionsApi(engine as any, { status, planId, customerId, limit, offset }, {
    collectionId,
    environment: 'development',
  });
  return c.json(result);
});

billing.get('/collections/:collectionId/subscriptions/:subscriptionId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const subscriptionId = c.req.param('subscriptionId');

  const result = await getSubscription(engine as any, { subscriptionId }, { collectionId });
  return c.json(result ?? null);
});

billing.post('/collections/:collectionId/subscriptions/:subscriptionId/pause', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const subscriptionId = c.req.param('subscriptionId');

  try {
    const result = await pauseSubscription(engine as any, subscriptionId, { collectionId });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

billing.post('/collections/:collectionId/subscriptions/:subscriptionId/resume', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const subscriptionId = c.req.param('subscriptionId');

  try {
    const result = await resumeSubscription(engine as any, subscriptionId, { collectionId });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

billing.post('/collections/:collectionId/subscriptions/:subscriptionId/reactivate', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const subscriptionId = c.req.param('subscriptionId');

  try {
    const result = await reactivateSubscription(engine as any, subscriptionId, { collectionId });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

// ==================== ENTITLEMENTS ====================

billing.post(
  '/collections/:collectionId/entitlements/check',
  zValidator('json', checkEntitlementSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const result = await check(engine, body, { collectionId });
    return c.json(result);
  }
);

billing.post(
  '/collections/:collectionId/entitlements/report',
  zValidator('json', reportEntitlementSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const result = await report(engine, body, { collectionId });
    return c.json(result);
  }
);

export { billing as BillingRoutes };
