// src/lib/logger.ts
import { drizzle } from 'drizzle-orm/d1';
import { systemLogs } from '../db/schema';
import { HonoEnv } from '../types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
  persist?: boolean; // if true, writes to systemLogs table
  context?: string; // e.g. "user-routes"
  userId?: string;
}

class Logger {
  private env: HonoEnv['Bindings'] | null = null;
  private ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  } | null = null;

  // Call this once per request in a Hono middleware
  // so the logger has access to env + ctx for that request lifetime
  // Replace the bind method signature
  bind(
    env: HonoEnv['Bindings'],
    ctx: {
      waitUntil(promise: Promise<unknown>): void;
      passThroughOnException(): void;
    }
  ) {
    this.env = env;
    this.ctx = ctx;
    return this;
  }

  private log(level: LogLevel, message: string, meta?: LogMeta) {
    const { persist, context, userId, ...rest } = meta ?? {};

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId,
      ...rest,
    };

    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }

    if (persist && this.env && this.ctx) {
      const env = this.env;
      const retainUntil = new Date();
      retainUntil.setDate(retainUntil.getDate() + 90);

      this.ctx.waitUntil(
        drizzle(env.semaphore_db)
          .insert(systemLogs)
          .values({
            logId: crypto.randomUUID(),
            level,
            message,
            context: context ?? null,
            userId: userId ?? null,
            meta: Object.keys(rest).length ? rest : null,
            retainUntil,
            createdAt: new Date(),
          })
          .run()
          .catch(err => {
            // Fallback to console so a DB failure never silently swallows the log
            console.error(
              JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'error',
                message: 'Failed to persist log to DB',
                originalMessage: message,
                error: err instanceof Error ? err.message : err,
              })
            );
          })
      );
    }
  }

  debug(message: string, meta?: LogMeta) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogMeta) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogMeta) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: LogMeta) {
    this.log('error', message, {
      ...meta,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    });
  }
}

export const logger = new Logger();
