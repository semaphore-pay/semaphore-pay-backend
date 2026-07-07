import { eq, and, desc } from 'drizzle-orm';
import type { SemaphorePayEngine } from '@semaphore-pay/server';
import * as sqliteSchema from '@semaphore-pay/server/schema/sqlite';
import { metricSnapshot } from '../db/schema';

export interface MetricSnapshot {
  id: string;
  collectionId: string;
  date: string;
  features: number;
  booleanFeatures: number;
  limitFeatures: number;
  plans: number;
  activePlans: number;
  products: number;
  customers: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  churnedSubscriptions: number;
  mrr: number;
  createdAt: Date;
}

export interface MetricTrend {
  current: MetricSnapshot | null;
  previous: MetricSnapshot | null;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function captureMetrics(
  engine: SemaphorePayEngine<any>,
  collectionId: string,
): Promise<MetricSnapshot | null> {
  const db = engine.db;
  const now = new Date();
  const date = formatDate(now);

  // Count features (global)
  const allFeatures = await db.select().from(sqliteSchema.feature);
  const features = allFeatures.length;
  const booleanFeatures = allFeatures.filter((f: any) => f.type === 'boolean').length;
  const limitFeatures = allFeatures.filter((f: any) => f.type === 'limit').length;

  // Count plans
  const allPlans = await db.select().from(sqliteSchema.plan).where(eq(sqliteSchema.plan.collectionId, collectionId));
  const plans = allPlans.length;
  const activePlans = allPlans.filter((p: any) => p.isActive).length;

  // Count products
  const allProducts = await db.select().from(sqliteSchema.product).where(eq(sqliteSchema.product.collectionId, collectionId));
  const products = allProducts.length;

  // Count customers
  const allCustomers = await db.select().from(sqliteSchema.customer).where(eq(sqliteSchema.customer.collectionId, collectionId));
  const customers = allCustomers.length;

  // Count subscriptions by status
  const allSubscriptions = await db.select().from(sqliteSchema.subscription).where(eq(sqliteSchema.subscription.collectionId, collectionId));
  const activeSubscriptions = allSubscriptions.filter(
    (s: any) => s.status === 'active',
  ).length;
  const trialingSubscriptions = allSubscriptions.filter(
    (s: any) => s.status === 'trialing',
  ).length;
  const churnedSubscriptions = allSubscriptions.filter(
    (s: any) => s.status === 'canceled',
  ).length;

  // Calculate MRR (only active subs, not trialing)
  let mrr = 0;
  for (const sub of allSubscriptions) {
    if (sub.status !== 'active') continue;
    const plan = allPlans.find((p: any) => p.id === sub.planId);
    if (!plan) continue;
    if (plan.interval === 'monthly') mrr += plan.priceAmount;
    else if (plan.interval === 'yearly') mrr += Math.round(plan.priceAmount / 12);
  }

  // Upsert snapshot
  const existing = await db.select({ id: metricSnapshot.id })
    .from(metricSnapshot)
    .where(and(eq(metricSnapshot.collectionId, collectionId), eq(metricSnapshot.date, date)))
    .limit(1);

  if (existing.length > 0) {
    const id = existing[0].id;
    await db.update(metricSnapshot).set({
      features,
      booleanFeatures,
      limitFeatures,
      plans,
      activePlans,
      products,
      customers,
      activeSubscriptions,
      trialingSubscriptions,
      churnedSubscriptions,
      mrr,
    }).where(eq(metricSnapshot.id, id));
    return { id, collectionId, date, features, booleanFeatures, limitFeatures, plans, activePlans, products, customers, activeSubscriptions, trialingSubscriptions, churnedSubscriptions, mrr, createdAt: now };
  }

  const id = `snap_${crypto.randomUUID()}`;
  await db.insert(metricSnapshot).values({
    id,
    collectionId,
    date,
    features,
    booleanFeatures,
    limitFeatures,
    plans,
    activePlans,
    products,
    customers,
    activeSubscriptions,
    trialingSubscriptions,
    churnedSubscriptions,
    mrr,
    createdAt: now,
  });

  return { id, collectionId, date, features, booleanFeatures, limitFeatures, plans, activePlans, products, customers, activeSubscriptions, trialingSubscriptions, churnedSubscriptions, mrr, createdAt: now };
}

export async function getMetricTrend(
  engine: SemaphorePayEngine<any>,
  collectionId: string,
): Promise<MetricTrend> {
  const db = engine.db;

  const rows = await db.select().from(metricSnapshot)
    .where(eq(metricSnapshot.collectionId, collectionId))
    .orderBy(desc(metricSnapshot.date))
    .limit(2);

  const mapRow = (row: typeof rows[0]): MetricSnapshot => ({
    id: row.id,
    collectionId: row.collectionId,
    date: row.date,
    features: row.features,
    booleanFeatures: row.booleanFeatures,
    limitFeatures: row.limitFeatures,
    plans: row.plans,
    activePlans: row.activePlans,
    products: row.products,
    customers: row.customers,
    activeSubscriptions: row.activeSubscriptions,
    trialingSubscriptions: row.trialingSubscriptions ?? 0,
    churnedSubscriptions: row.churnedSubscriptions ?? 0,
    mrr: row.mrr,
    createdAt: row.createdAt,
  });

  return {
    current: rows[0] ? mapRow(rows[0]) : null,
    previous: rows[1] ? mapRow(rows[1]) : null,
  };
}

export async function getMetricHistory(
  engine: SemaphorePayEngine<any>,
  collectionId: string,
  limit: number = 90,
): Promise<MetricSnapshot[]> {
  const db = engine.db;

  const rows = await db.select().from(metricSnapshot)
    .where(eq(metricSnapshot.collectionId, collectionId))
    .orderBy(desc(metricSnapshot.date))
    .limit(limit);

  return rows.map((row: any) => ({
    id: row.id,
    collectionId: row.collectionId,
    date: row.date,
    features: row.features,
    booleanFeatures: row.booleanFeatures,
    limitFeatures: row.limitFeatures,
    plans: row.plans,
    activePlans: row.activePlans,
    products: row.products,
    customers: row.customers,
    activeSubscriptions: row.activeSubscriptions,
    trialingSubscriptions: row.trialingSubscriptions ?? 0,
    churnedSubscriptions: row.churnedSubscriptions ?? 0,
    mrr: row.mrr,
    createdAt: row.createdAt,
  }));
}
