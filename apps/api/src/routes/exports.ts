import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@you-design/db';
import { CreateExportBody } from '@you-design/shared';
import { exportQueue } from '../lib/queues.js';

export async function exportsRoutes(app: FastifyInstance) {
  // POST /exports — create job
  app.post('/exports', async (req, reply) => {
    const parsed = CreateExportBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const { projectId, format } = parsed.data;

    const pages = await db
      .select({ path: schema.projectPages.path, title: schema.projectPages.title, html: schema.projectPages.html })
      .from(schema.projectPages)
      .where(eq(schema.projectPages.projectId, projectId));

    const [job] = await db
      .insert(schema.exportJobs)
      .values({ projectId, format })
      .returning();

    await exportQueue.add('export', {
      jobId: job!.id,
      projectId,
      format,
      pages,
    });

    reply.code(202);
    return { jobId: job!.id };
  });

  // GET /exports/:jobId — status
  app.get('/exports/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const [row] = await db
      .select()
      .from(schema.exportJobs)
      .where(eq(schema.exportJobs.id, jobId));
    if (!row) {
      reply.code(404);
      return { error: 'NOT_FOUND' };
    }
    return { id: row.id, format: row.format, status: row.status, errorMsg: row.errorMsg };
  });

  // GET /exports/:jobId/download — serve file
  app.get('/exports/:jobId/download', async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const [row] = await db
      .select()
      .from(schema.exportJobs)
      .where(eq(schema.exportJobs.id, jobId));

    if (!row) { reply.code(404); return { error: 'NOT_FOUND' }; }
    if (row.status !== 'done' || !row.filePath) {
      reply.code(409);
      return { error: 'NOT_READY', status: row.status };
    }
    if (!fs.existsSync(row.filePath)) {
      reply.code(404);
      return { error: 'FILE_MISSING' };
    }

    const ext = path.extname(row.filePath).slice(1);
    const contentType =
      ext === 'pdf' ? 'application/pdf' :
      ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
      'text/html';

    reply.header('Content-Disposition', `attachment; filename="export.${ext}"`);
    reply.header('Content-Type', contentType);
    return reply.send(fs.createReadStream(row.filePath));
  });
}
