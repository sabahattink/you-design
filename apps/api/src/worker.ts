import { Worker } from 'bullmq';
import { env } from './config.js';
import { redis } from './lib/redis.js';

async function main() {
  console.log('[worker] starting...');

  const exportWorker = new Worker(
    'export-queue',
    async (job) => {
      console.log(`[worker:export] job ${job.id} — ${job.name}`, job.data);
      return { ok: true, note: 'export logic in M3' };
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY },
  );

  const llmWorker = new Worker(
    'llm-queue',
    async (job) => {
      console.log(`[worker:llm] job ${job.id} — ${job.name}`, job.data);
      return { ok: true, note: 'llm logic in M2' };
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY },
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down...`);
    await Promise.all([exportWorker.close(), llmWorker.close()]);
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('[worker] ready — listening on export-queue, llm-queue');
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
