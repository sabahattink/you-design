import IORedis from 'ioredis';
import { env } from '../config.js';

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});
