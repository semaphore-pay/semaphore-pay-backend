import { eq, and, count } from 'drizzle-orm';
import { initSemaphorePay, type SemaphorePayEngine } from '@semaphore-pay/server';
import * as sqliteSchema from '@semaphore-pay/server/schema/sqlite';

const QUOTAS = {
  collections: 10,
  plans: 5,
  products: Infinity,
  entitlements: 100,
} as const;

type QuotaType = keyof typeof QUOTAS;

export async function checkQuota(
  engine: SemaphorePayEngine<'sqlite'>,
  userId: string,
  type: QuotaType,
  collectionId?: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = engine.db;
  const limit = QUOTAS[type];

  if (limit === Infinity) {
    return { allowed: true, current: 0, limit: Infinity };
  }

  if (type === 'collections') {
    const keys = await db
      .select({ collectionId: sqliteSchema.apiKey.collectionId })
      .from(sqliteSchema.apiKey)
      .where(eq(sqliteSchema.apiKey.userId, userId));

    const uniqueCollections = new Set(keys.map((k: { collectionId: string }) => k.collectionId));
    return {
      allowed: uniqueCollections.size < limit,
      current: uniqueCollections.size,
      limit,
    };
  }

  if (type === 'plans' && collectionId) {
    const plans = await db
      .select()
      .from(sqliteSchema.plan)
      .where(
        and(
          eq(sqliteSchema.plan.collectionId, collectionId),
          eq(sqliteSchema.plan.environment, 'development')
        )
      );

    return {
      allowed: plans.length < limit,
      current: plans.length,
      limit,
    };
  }

  return { allowed: true, current: 0, limit };
}
