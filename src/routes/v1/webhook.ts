import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { initSemaphorePay, handleWebhook, sqliteSchema } from '@semaphore-pay/server';
import { logger } from '../../lib/logger';
import { balance } from '../../db/schema';
import type { HonoEnv } from '../../types';

const webhook = new Hono<HonoEnv>();

webhook.post('/', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('nomba-signature') ?? '';
  const nombaTimestamp = c.req.header('nomba-timestamp') ?? '';

  const db = drizzle(c.env.semaphore_db, { schema: sqliteSchema });
  const engine = initSemaphorePay({ dialect: 'sqlite', db, supportsTransactions: false });

  try {
    const result = await handleWebhook(engine, {
      rawBody,
      signature,
      webhookSecret: c.env.NOMBA_WEBHOOK_SECRET,
      nombaTimestamp,
    });

    // Track balance on successful payment
    if (result.status === 'processed') {
      try {
        const payload = JSON.parse(rawBody);
        const eventType = payload.event_type ?? payload.event;

        if (eventType === 'payment_success') {
          const data = payload.data;
          const reference = data?.order?.orderReference ?? data?.merchantTxRef ?? data?.orderReference;
          const amount = data?.order?.amount ?? data?.transaction?.transactionAmount ?? data.amount;
          const currency = data?.order?.currency ?? data?.currency ?? 'NGN';

          if (reference && amount) {
            // Find subscription to get collectionId
            const subscription = await engine.db.query.subscription.findFirst({
              where: eq(engine.schema.subscription.nombaOrderReference, reference),
            });

            if (subscription?.collectionId) {
              const collectionId = subscription.collectionId;
              const now = new Date();
              const feeRate = 135; // 1.35%
              const fee = Math.round(amount * feeRate / 10000);
              const netAmount = amount - fee;

              // Get or create balance record
              const existingBalance = await db.select().from(balance)
                .where(eq(balance.collectionId, collectionId))
                .get();

              if (existingBalance) {
                await db.update(balance).set({
                  available: existingBalance.available + netAmount,
                  totalEarned: existingBalance.totalEarned + netAmount,
                  updatedAt: now,
                }).where(eq(balance.id, existingBalance.id));
              } else {
                await db.insert(balance).values({
                  id: crypto.randomUUID(),
                  collectionId,
                  available: netAmount,
                  pending: 0,
                  totalEarned: netAmount,
                  platformFeeRate: feeRate,
                  currency,
                  createdAt: now,
                  updatedAt: now,
                });
              }

              logger.info('Balance updated', {
                context: 'webhook',
                meta: { collectionId, amount, fee, netAmount },
              });
            }
          }
        }
      } catch (balanceError) {
        // Don't fail webhook if balance tracking fails
        logger.error('Balance tracking failed', balanceError as Error, {
          context: 'webhook',
          persist: true,
        });
      }
    }

    logger.info('Webhook processed', {
      context: 'webhook',
      meta: { result },
    });

    return c.json(result);
  } catch (error) {
    logger.error('Webhook processing failed', error as Error, {
      context: 'webhook',
      persist: true,
    });

    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export { webhook as WebhookRoutes };
