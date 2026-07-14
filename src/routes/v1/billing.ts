import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { initSemaphorePay, createCollection, createApiKey, runSemaphorePayCron } from '@semaphore-pay/server';
import { updateCollection } from '@semaphore-pay/server/api';
import { createProduct, listProducts, getProduct, updateProduct, deleteProduct } from '@semaphore-pay/server/product';
import { create, list, get, deactivate, reactivatePlanApi, remove } from '@semaphore-pay/server/plan';
import { subscribe, cancel, get as getSubscription, list as listSubscriptionsApi, pause as pauseSubscription, resume as resumeSubscription, reactivate as reactivateSubscription } from '@semaphore-pay/server/subscription';
import { check, report } from '@semaphore-pay/server/entitlement';
import { upsertCustomer, getCustomer, listCustomersApi } from '@semaphore-pay/server/customer';
import { create as createFeatureApi, list as listFeaturesApi, remove as removeFeatureApi, attachPlan, detachPlan, attachProduct, detachProduct } from '@semaphore-pay/server/feature';
import type { SemaphorePayEngine } from '@semaphore-pay/server';
import * as sqliteSchema from '@semaphore-pay/server/schema/sqlite';
import { requireAuth } from '../../lib/auth';
import { checkQuota } from '../../services/quotas';
import { getCollectionStats, getCollectionAnalytics } from '../../services/analytics';
import { getMetricTrend, getMetricHistory, captureMetrics } from '../../services/metrics';
import { balance } from '../../db/schema';
import { logger } from '../../lib/logger';
import {
  zValidator,
  createCollectionSchema,
  createPlanSchema,
  createProductSchema,
  updateProductSchema,
  upsertCustomerSchema,
  subscribeSchema,
  checkEntitlementSchema,
  reportEntitlementSchema,
  createFeatureSchema,
  attachPlanFeatureSchema,
  attachProductFeatureSchema,
} from '../../lib/validators';
import type { HonoEnv } from '../../types';

const billing = new Hono<HonoEnv>();

function getEngine(env: HonoEnv['Bindings']): SemaphorePayEngine<'sqlite'> {
  const db = drizzle(env.semaphore_db, { schema: sqliteSchema });
  return initSemaphorePay({ dialect: 'sqlite', db, supportsTransactions: false });
}

async function getCollectionEnvironment(db: any, collectionId: string): Promise<"sandbox" | "production"> {
  const d1 = drizzle(db);
  const rows = await d1.select({ environment: sqliteSchema.collection.environment })
    .from(sqliteSchema.collection)
    .where(eq(sqliteSchema.collection.id, collectionId))
    .limit(1);
  return (rows[0]?.environment as "sandbox" | "production") ?? "sandbox";
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

  const collection = await createCollection(engine, body.name, body.environment ?? 'sandbox');
  const keyEnv = collection.environment === 'production' ? 'production' : 'development';
  const publicKey = await createApiKey(engine, {
    collectionId: collection.id,
    type: 'public',
    environment: keyEnv,
    userId: user.id,
  });
  const secretKey = await createApiKey(engine, {
    collectionId: collection.id,
    type: 'secret',
    environment: keyEnv,
  });

  logger.info('Collection created', {
    context: 'billing',
    userId: user.id,
    meta: { collectionId: collection.id, name: body.name, environment: collection.environment },
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

billing.put('/collections/:id', async (c) => {
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

  const body = await c.req.json();
  const engine = getEngine(c.env);
  const result = await updateCollection(engine, collectionId, {
    name: body.name,
    callbackUrl: body.callbackUrl,
  });
  return c.json(result);
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

// ==================== API KEYS ====================

billing.get('/collections/:collectionId/api-keys', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const db = drizzle(c.env.semaphore_db, { schema: sqliteSchema });
  const collectionId = c.req.param('collectionId');

  const keys = await db
    .select({
      key: sqliteSchema.apiKey.key,
      type: sqliteSchema.apiKey.type,
      environment: sqliteSchema.apiKey.environment,
      collectionId: sqliteSchema.apiKey.collectionId,
      userId: sqliteSchema.apiKey.userId,
      createdAt: sqliteSchema.apiKey.createdAt,
    })
    .from(sqliteSchema.apiKey)
    .where(
      and(
        eq(sqliteSchema.apiKey.collectionId, collectionId),
      )
    );

  return c.json(keys);
});

billing.post('/collections/:collectionId/api-keys', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const body = await c.req.json();

  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const keyEnv = env === 'sandbox' ? 'development' : 'production';

  const key = await createApiKey(engine, {
    collectionId,
    type: body.type ?? 'secret',
    environment: body.environment ?? keyEnv,
    userId: user.id,
  });

  return c.json(key);
});

billing.delete('/collections/:collectionId/api-keys/:key', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const db = drizzle(c.env.semaphore_db, { schema: sqliteSchema });
  const collectionId = c.req.param('collectionId');
  const keyStr = c.req.param('key');

  const key = await db
    .select()
    .from(sqliteSchema.apiKey)
    .where(
      and(
        eq(sqliteSchema.apiKey.key, keyStr),
        eq(sqliteSchema.apiKey.collectionId, collectionId),
        eq(sqliteSchema.apiKey.userId, user.id)
      )
    )
    .get();

  if (!key) {
    return c.json({ error: 'Key not found' }, 404);
  }

  await db
    .delete(sqliteSchema.apiKey)
    .where(eq(sqliteSchema.apiKey.key, keyStr));

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

    const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
    const planEnv = env === 'sandbox' ? 'development' : 'production';

    const result = await create(engine, body, {
      collectionId,
      environment: planEnv,
    });

    return c.json(result);
  }
);

billing.get('/collections/:collectionId/plans', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await list(engine, {}, { collectionId, environment: planEnv });
  return c.json(result);
});

billing.get('/collections/:collectionId/plans/:planId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const planId = c.req.param('planId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await get(engine, { planId }, { collectionId, environment: planEnv });
  return c.json(result ?? null);
});

billing.post('/collections/:collectionId/plans/:planId/deactivate', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const planId = c.req.param('planId');
  const body = await c.req.json().catch(() => ({}));
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await deactivate(engine, { planId, cancelRenewals: body.cancelRenewals }, { collectionId, environment: planEnv });
  return c.json(result);
});

billing.post('/collections/:collectionId/plans/:planId/reactivate', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const planId = c.req.param('planId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await reactivatePlanApi(engine, { planId }, { collectionId, environment: planEnv });
  return c.json(result);
});

billing.delete('/collections/:collectionId/plans/:planId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const planId = c.req.param('planId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  try {
    await remove(engine, { planId }, { collectionId, environment: planEnv });
  } catch (err) {
    if (err instanceof Error && err.message.includes('active subscriptions')) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
  return c.json({ success: true });
});

// ==================== PRODUCTS ====================

billing.post(
  '/collections/:collectionId/products',
  zValidator('json', createProductSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');
    const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
    const planEnv = env === 'sandbox' ? 'development' : 'production';

    const result = await createProduct(engine, {
      ...body,
      collectionId,
      environment: planEnv,
    });

    return c.json(result);
  }
);

billing.get('/collections/:collectionId/products', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await listProducts(engine, { collectionId, environment: planEnv });
  return c.json(result);
});

billing.get('/collections/:collectionId/products/:productId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const productId = c.req.param('productId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await getProduct(engine, { productId, collectionId, environment: planEnv });
  return c.json(result ?? null);
});

billing.put(
  '/collections/:collectionId/products/:productId',
  zValidator('json', updateProductSchema),
  async (c) => {
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const productId = c.req.param('productId');
    const body = c.req.valid('json');
    const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
    const planEnv = env === 'sandbox' ? 'development' : 'production';

    try {
      const result = await updateProduct(engine, {
        productId,
        ...body,
        collectionId,
        environment: planEnv,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.delete('/collections/:collectionId/products/:productId', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const productId = c.req.param('productId');
  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  try {
    await deleteProduct(engine, { productId, collectionId, environment: planEnv });
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
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

billing.get('/collections/:collectionId/customers', async (c) => {
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');
  const search = c.req.query('search') ?? undefined;
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
  const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;

  const baseResult = await listCustomersApi(engine, { search, limit, offset }, { collectionId });

  if (baseResult.data.length === 0) {
    return c.json(baseResult);
  }

  const db = drizzle(c.env.semaphore_db, { schema: sqliteSchema });
  const customerIds = baseResult.data.map((c: any) => c.id);

  const subStats = await db
    .select({
      customerId: sqliteSchema.subscription.customerId,
      count: sql<number>`count(*)`,
      lastActivity: sql<Date>`max(${sqliteSchema.subscription.updatedAt})`,
    })
    .from(sqliteSchema.subscription)
    .where(
      and(
        sql`${sqliteSchema.subscription.collectionId} = ${collectionId}`,
        sql`${sqliteSchema.subscription.customerId} in ${customerIds}`,
      )
    )
    .groupBy(sqliteSchema.subscription.customerId);

  const subMap = new Map(subStats.map((s: any) => [s.customerId, s]));

  const enriched = baseResult.data.map((cust: any) => {
    const stats = subMap.get(cust.id);
    const lastActivity = stats?.lastActivity;
    let lastActivityAt: string | null = null;
    if (lastActivity) {
      lastActivityAt = typeof lastActivity === 'string' ? lastActivity : new Date(lastActivity).toISOString();
    }
    return {
      ...cust,
      subscriptionCount: stats?.count ?? 0,
      activeSubscriptionCount: 0,
      lastActivityAt,
    };
  });

  return c.json({ ...baseResult, data: enriched });
});

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
    const db = drizzle(c.env.semaphore_db, { schema: sqliteSchema });
    const collectionId = c.req.param('collectionId');
    const body = c.req.valid('json');

    const col = await db.select().from(sqliteSchema.collection).where(eq(sqliteSchema.collection.id, collectionId)).get();
    const environment = col?.environment === 'production' ? 'production' : 'development';

    const result = await subscribe(engine, body, {
      collectionId,
      environment,
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

  const env = await getCollectionEnvironment(c.env.semaphore_db, collectionId);
  const planEnv = env === 'sandbox' ? 'development' : 'production';

  const result = await listSubscriptionsApi(engine as any, { status, planId, customerId, limit, offset }, {
    collectionId,
    environment: planEnv,
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

// ==================== FEATURES ====================

billing.post(
  '/collections/:collectionId/features',
  zValidator('json', createFeatureSchema),
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const collectionId = c.req.param('collectionId');
      const body = c.req.valid('json');

      const result = await createFeatureApi(engine, body, { collectionId });
      return c.json(result);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.get(
  '/collections/:collectionId/features',
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const collectionId = c.req.param('collectionId');
      const result = await listFeaturesApi(engine, {}, { collectionId });
      return c.json(result);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.delete(
  '/collections/:collectionId/features/:featureId',
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const featureId = c.req.param('featureId');

      await removeFeatureApi(engine, { featureId }, { collectionId: c.req.param('collectionId') });
      return c.json({ success: true });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.post(
  '/collections/:collectionId/features/attach-plan',
  zValidator('json', attachPlanFeatureSchema),
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const collectionId = c.req.param('collectionId');
      const body = c.req.valid('json');

      const result = await attachPlan(engine, body, { collectionId });
      return c.json(result);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.post(
  '/collections/:collectionId/features/detach-plan',
  zValidator('json', attachPlanFeatureSchema.pick({ planId: true, featureId: true })),
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const collectionId = c.req.param('collectionId');
      const body = c.req.valid('json');

      await detachPlan(engine, body, { collectionId });
      return c.json({ success: true });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.post(
  '/collections/:collectionId/features/attach-product',
  zValidator('json', attachProductFeatureSchema),
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const collectionId = c.req.param('collectionId');
      const body = c.req.valid('json');

      const result = await attachProduct(engine, body, { collectionId });
      return c.json(result);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

billing.post(
  '/collections/:collectionId/features/detach-product',
  zValidator('json', attachProductFeatureSchema.pick({ productInternalId: true, featureId: true })),
  async (c) => {
    try {
      const engine = getEngine(c.env);
      const collectionId = c.req.param('collectionId');
      const body = c.req.valid('json');

      await detachProduct(engine, body, { collectionId });
      return c.json({ success: true });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  }
);

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

// ── Metrics ──────────────────────────────────────────────

billing.get(
  '/collections/:collectionId/metrics/trend',
  async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const trend = await getMetricTrend(engine, collectionId);
    return c.json(trend);
  }
);

billing.get(
  '/collections/:collectionId/metrics/history',
  async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const limit = parseInt(c.req.query('limit') ?? '90', 10);
    const history = await getMetricHistory(engine, collectionId, limit);
    return c.json(history);
  }
);

billing.post(
  '/collections/:collectionId/metrics/refresh',
  async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const engine = getEngine(c.env);
    const collectionId = c.req.param('collectionId');
    const snapshot = await captureMetrics(engine, collectionId);
    return c.json({ success: true, snapshot });
  }
);

// ── Balance ──────────────────────────────────────────────

billing.get(
  '/collections/:collectionId/balance',
  async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = drizzle(c.env.semaphore_db);
    const collectionId = c.req.param('collectionId');

    const balanceRecord = await db.select().from(balance)
      .where(eq(balance.collectionId, collectionId))
      .get();

    if (!balanceRecord) {
      return c.json({
        available: 0,
        pending: 0,
        totalEarned: 0,
        platformFeeRate: 135,
        currency: 'NGN',
      });
    }

    return c.json({
      available: balanceRecord.available,
      pending: balanceRecord.pending,
      totalEarned: balanceRecord.totalEarned,
      platformFeeRate: balanceRecord.platformFeeRate,
      currency: balanceRecord.currency,
    });
  }
);

export { billing as BillingRoutes };

// ==================== CRON ====================

billing.post('/collections/:collectionId/cron/run', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const engine = getEngine(c.env);
  const collectionId = c.req.param('collectionId');

  const result = await runSemaphorePayCron(engine);
  return c.json(result);
});
