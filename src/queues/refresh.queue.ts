import 'dotenv/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';

export const refreshQueueConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const refreshQueue = new Queue('vendor-refresh', {
  connection: refreshQueueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1_000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
    },
  },
});
