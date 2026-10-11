import { rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

export const refreshRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === 'production' ? 3 : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  ...(process.env.NODE_ENV !== 'test' && {
    store: new RedisStore({
      prefix: 'vendor-refresh-rate-limit:',
      sendCommand: async (...args: string[]): Promise<RedisReply> => {
        const { refreshQueueConnection } = await import('../queues/refresh.queue.js');
        const result: unknown = await refreshQueueConnection.call(args[0], ...args.slice(1));
        if (
          typeof result === 'string' ||
          typeof result === 'number' ||
          typeof result === 'boolean'
        ) {
          return result;
        }
        if (
          Array.isArray(result) &&
          result.every(
            (value) =>
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean',
          )
        ) {
          return result;
        }
        throw new TypeError('Unexpected response from Redis rate-limit command.');
      },
    }),
  }),
  message: { error: 'Too many refresh requests. Please try again later.' },
});