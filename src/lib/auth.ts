import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { HonoEnv } from '../types';
import { magicLink } from 'better-auth/plugins';
import { APIError } from 'better-auth/api';

import { magicLinkEmail } from '../data/email-templates/magicLinkEmail';

export const getAuth = (env: HonoEnv['Bindings']) => {
  const db = drizzle(env.semaphore_db, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: true,
          defaultValue: 'buyer',
          input: true,
        },
        phoneNumber: { type: 'string', required: false, input: true },
        profileSetupComplete: { type: 'boolean', defaultValue: false },
        username: { type: 'string', required: false, input: true },
        businessType: {
          type: 'string',
          required: true,
          input: true,
          defaultValue: 'none',
        },
      },
    },
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:8787',
    basePath: '/api/auth',
    trustedOrigins: ['https://dash.semaphorepay.tech', 'exp://127.0.0.1:8081'],
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, token, url }, request) => {
          const userName = email.split('@')[0];
          const html = magicLinkEmail(userName, url);

          try {
            await env.EMAIL.send({
              to: email,
              from: 'auth@semaphorepay.tech',
              subject: 'Sign in to Semaphore Pay',
              html: html,
              text: `Sign in to Semaphore Pay by clicking this link: ${url}`,
            });
          } catch (error) {
            console.error('Failed to send magic link:', error);
            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Failed to send authentication email.',
            });
          }
        },
      }),
    ],
  });
};

export function requireAuth(c: {
  get: (key: string) => unknown;
}):
  | {
      user: HonoEnv['Variables']['user'];
      session: HonoEnv['Variables']['session'];
    }
  | Response {
  const user = c.get('user');
  if (!user) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return {
    user: user as HonoEnv['Variables']['user'],
    session: c.get('session') as HonoEnv['Variables']['session'],
  };
}
