import { user, session } from './db/schema';
import { InferSelectModel } from 'drizzle-orm';

// Database Types
export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;

export interface Env {
  semaphore_db: D1Database;
  EMAIL: SendEmail;
  ASSETS: Fetcher;

  // Better Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // CORS
  FRONTEND_URL: string;

  // Nomba (sandbox)
  NOMBA_SANDBOX_CLIENT_ID: string;
  NOMBA_SANDBOX_CLIENT_SECRET: string;
  NOMBA_SANDBOX_ACCOUNT_ID: string;

  // Nomba (production)
  NOMBA_LIVE_CLIENT_ID: string;
  NOMBA_LIVE_CLIENT_SECRET: string;
  NOMBA_LIVE_ACCOUNT_ID: string;

  // Nomba (shared)
  NOMBA_WEBHOOK_SECRET: string;
  NOMBA_CHECKOUT_CALLBACK_URL: string;

  // Cloudflare
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_DATABASE_ID: string;
  CLOUDFLARE_D1_TOKEN: string;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    user: User;
    session: Session;
  };
};
