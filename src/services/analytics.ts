import { eq, and, count } from 'drizzle-orm';
import type { SemaphorePayEngine } from '@semaphore-pay/server';
import * as sqliteSchema from '@semaphore-pay/server/schema/sqlite';

export async function getCollectionStats(
  engine: SemaphorePayEngine<'sqlite'>,
  collectionId: string,
) {
  const db = engine.db;

  const planCount = await db
    .select({ value: count() })
    .from(sqliteSchema.plan)
    .where(
      and(
        eq(sqliteSchema.plan.collectionId, collectionId),
        eq(sqliteSchema.plan.environment, 'development')
      )
    );

  const productCount = await db
    .select({ value: count() })
    .from(sqliteSchema.product)
    .where(
      and(
        eq(sqliteSchema.product.collectionId, collectionId),
        eq(sqliteSchema.product.environment, 'development')
      )
    );

  const customerCount = await db
    .select({ value: count() })
    .from(sqliteSchema.customer)
    .where(eq(sqliteSchema.customer.collectionId, collectionId));

  const activeSubscriptions = await db
    .select({ value: count() })
    .from(sqliteSchema.subscription)
    .where(
      and(
        eq(sqliteSchema.subscription.collectionId, collectionId),
        eq(sqliteSchema.subscription.status, 'active')
      )
    );

  return {
    plans: planCount[0]?.value ?? 0,
    products: productCount[0]?.value ?? 0,
    customers: customerCount[0]?.value ?? 0,
    activeSubscriptions: activeSubscriptions[0]?.value ?? 0,
  };
}
