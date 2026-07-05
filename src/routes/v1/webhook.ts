import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { initSemaphorePay, handleWebhook } from '@semaphore-pay/server';
import { logger } from '../../lib/logger';
import type { HonoEnv } from '../../types';

const webhook = new Hono<HonoEnv>();

webhook.post('/nomba', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('nomba-signature') ?? '';

  const db = drizzle(c.env.semaphore_db);
  const engine = initSemaphorePay({ dialect: 'sqlite', db, supportsTransactions: false });

  try {
    const result = await handleWebhook(engine, {
      rawBody,
      signature,
      webhookSecret: c.env.NOMBA_WEBHOOK_SECRET,
    });

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
