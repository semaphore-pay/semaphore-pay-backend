import { eq, and, count, sql } from 'drizzle-orm';
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

export interface CollectionAnalytics {
  mrr: number;
  arr: number;
  activeTrials: number;
  subscribersByStatus: Record<string, number>;
  planBreakdown: Array<{
    planId: string;
    planName: string;
    subscribers: number;
    mrr: number;
    interval: string;
  }>;
  stats: {
    plans: number;
    products: number;
    customers: number;
    activeSubscriptions: number;
  };
}

export async function getCollectionAnalytics(
  engine: SemaphorePayEngine<'sqlite'>,
  collectionId: string,
): Promise<CollectionAnalytics> {
  const db = engine.db;

  const stats = await getCollectionStats(engine, collectionId);

  const subscribersByStatusRows = await db
    .select({
      status: sqliteSchema.subscription.status,
      value: count(),
    })
    .from(sqliteSchema.subscription)
    .where(eq(sqliteSchema.subscription.collectionId, collectionId))
    .groupBy(sqliteSchema.subscription.status);

  const subscribersByStatus: Record<string, number> = {};
  for (const row of subscribersByStatusRows) {
    subscribersByStatus[row.status] = row.value ?? 0;
  }

  const activeTrials = subscribersByStatus['trialing'] ?? 0;

  const mrrResult = await db
    .select({
      mrr: sql<number>`COALESCE(SUM(
        CASE
          WHEN ${sqliteSchema.plan.interval} = 'monthly' THEN ${sqliteSchema.plan.priceAmount}
          WHEN ${sqliteSchema.plan.interval} = 'yearly' THEN ${sqliteSchema.plan.priceAmount} / 12
          ELSE 0
        END
      ), 0)`,
    })
    .from(sqliteSchema.subscription)
    .innerJoin(
      sqliteSchema.plan,
      and(
        eq(sqliteSchema.subscription.planId, sqliteSchema.plan.id),
        eq(sqliteSchema.plan.collectionId, collectionId),
      )
    )
    .where(
      and(
        eq(sqliteSchema.subscription.collectionId, collectionId),
        eq(sqliteSchema.subscription.status, 'active'),
      )
    );

  const mrr = Number(mrrResult[0]?.mrr ?? 0);
  const arr = mrr * 12;

  const planBreakdownRows = await db
    .select({
      planId: sqliteSchema.subscription.planId,
      planName: sqliteSchema.plan.name,
      interval: sqliteSchema.plan.interval,
      subscribers: count(),
      mrr: sql<number>`SUM(
        CASE
          WHEN ${sqliteSchema.plan.interval} = 'monthly' THEN ${sqliteSchema.plan.priceAmount}
          WHEN ${sqliteSchema.plan.interval} = 'yearly' THEN ${sqliteSchema.plan.priceAmount} / 12
          ELSE 0
        END
      )`,
    })
    .from(sqliteSchema.subscription)
    .innerJoin(
      sqliteSchema.plan,
      and(
        eq(sqliteSchema.subscription.planId, sqliteSchema.plan.id),
        eq(sqliteSchema.plan.collectionId, collectionId),
      )
    )
    .where(
      and(
        eq(sqliteSchema.subscription.collectionId, collectionId),
        eq(sqliteSchema.subscription.status, 'active'),
      )
    )
    .groupBy(sqliteSchema.subscription.planId, sqliteSchema.plan.name, sqliteSchema.plan.interval);

  const planBreakdown = planBreakdownRows.map((row: any) => ({
    planId: row.planId,
    planName: row.planName,
    subscribers: row.subscribers ?? 0,
    mrr: Number(row.mrr ?? 0),
    interval: row.interval,
  }));

  return {
    mrr,
    arr,
    activeTrials,
    subscribersByStatus,
    planBreakdown,
    stats,
  };
}
