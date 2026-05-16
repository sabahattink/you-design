import type { FastifyInstance } from 'fastify';
import { redis } from '../lib/redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const [redisOk] = await Promise.all([pingRedis()]);
    const ok = redisOk;
    return {
      status: ok ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        redis: redisOk ? 'ok' : 'down',
        postgres: 'unknown',
      },
    };
  });
}

async function pingRedis(): Promise<boolean> {
  try {
    const r = await redis.ping();
    return r === 'PONG';
  } catch {
    return false;
  }
}
