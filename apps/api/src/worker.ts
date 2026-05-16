import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '@you-design/db';
import { env } from './config.js';
import { redis } from './lib/redis.js';
import { runPdfExport } from './lib/export-pdf.js';
import { runPptxExport } from './lib/export-pptx.js';

interface ExportJobData {
  jobId: string;
  projectId: string;
  format: 'html' | 'pdf' | 'pptx';
  pages: Array<{ path: string; title: string; html: string }>;
}

async function main() {
  console.log('[worker] starting...');

  const exportWorker = new Worker<ExportJobData>(
    'export-queue',
    async (job) => {
      const { jobId, format, pages } = job.data;
      console.log(`[worker:export] job ${jobId} format=${format} pages=${pages.length}`);

      await db
        .update(schema.exportJobs)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(schema.exportJobs.id, jobId));

      try {
        let filePath: string;
        if (format === 'pdf') {
          filePath = await runPdfExport(jobId, pages);
        } else if (format === 'pptx') {
          filePath = await runPptxExport(jobId, pages);
        } else {
          throw new Error(`Unknown format: ${format}`);
        }

        await db
          .update(schema.exportJobs)
          .set({ status: 'done', filePath, updatedAt: new Date() })
          .where(eq(schema.exportJobs.id, jobId));

        console.log(`[worker:export] job ${jobId} done → ${filePath}`);
        return { ok: true, filePath };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db
          .update(schema.exportJobs)
          .set({ status: 'failed', errorMsg, updatedAt: new Date() })
          .where(eq(schema.exportJobs.id, jobId));

        console.error(`[worker:export] job ${jobId} failed:`, errorMsg);
        throw err;
      }
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY },
  );

  const llmWorker = new Worker(
    'llm-queue',
    async (job) => {
      console.log(`[worker:llm] job ${job.id} — ${job.name}`, job.data);
      return { ok: true };
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY },
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down...`);
    await Promise.all([exportWorker.close(), llmWorker.close()]);
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log('[worker] ready — listening on export-queue, llm-queue');
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
