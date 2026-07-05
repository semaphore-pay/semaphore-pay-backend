import * as z from 'zod';
import type { ValidationTargets } from 'hono';
import { zValidator as zv } from '@hono/zod-validator';

/**
 * Reusable Zod validator wrapper for Hono routes.
 * Returns structured JSON errors on validation failure.
 */
export const zValidator = <T extends z.ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            details: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        400,
      );
    }
  });

// ==================== COLLECTIONS ====================

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

// ==================== PLANS ====================

export const createPlanSchema = z.object({
  id: z.string().min(1, 'Plan ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  priceAmount: z.number().int().min(0),
  priceCurrency: z.string().optional(),
  interval: z.enum(['monthly', 'yearly', 'none']),
  trialPeriodDays: z.number().int().min(0).optional(),
  features: z
    .array(
      z.object({
        featureId: z.string(),
        type: z.enum(['boolean', 'limit']),
        limit: z.number().int().nullable().optional(),
        resetInterval: z.enum(['day', 'week', 'month', 'year']).nullable().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
  badge: z.string().optional(),
  ctaText: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ==================== PRODUCTS ====================

export const createProductSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Name is required'),
  group: z.string().optional(),
  isDefault: z.boolean().optional(),
  priceAmount: z.number().int().min(0).nullable().optional(),
  priceCurrency: z.string().optional(),
  priceInterval: z.string().optional(),
  version: z.number().int().optional(),
  features: z
    .array(
      z.object({
        featureId: z.string(),
        type: z.enum(['boolean', 'limit']),
        limit: z.number().int().nullable().optional(),
        resetInterval: z.enum(['day', 'week', 'month', 'year']).nullable().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

// ==================== CUSTOMERS ====================

export const upsertCustomerSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().min(1, 'userId is required'),
  email: z.string().email().optional(),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

// ==================== SUBSCRIPTIONS ====================

export const subscribeSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  planId: z.string().min(1, 'planId is required'),
});

// ==================== ENTITLEMENTS ====================

export const checkEntitlementSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  featureId: z.string().min(1, 'featureId is required'),
  required: z.number().int().min(1).optional(),
});

export const reportEntitlementSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  featureId: z.string().min(1, 'featureId is required'),
  amount: z.number().int().min(1).optional(),
});
