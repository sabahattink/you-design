import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@you-design/db';
import { estimateCost } from '@you-design/shared';

const LogBody = z.object({
  projectId: z.string().uuid().optional(),
  agent: z.string().min(1),
  modelName: z.string().min(1),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
});

export async function usageRoutes(app: FastifyInstance) {
  app.post('/usage', async (req, reply) => {
    const parsed = LogBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const { projectId, agent, modelName, promptTokens, completionTokens } = parsed.data;
    const estimatedCostUsd = estimateCost(modelName, promptTokens, completionTokens);

    await db.insert(schema.usageLogs).values({
      projectId: projectId ?? null,
      agent,
      modelName,
      promptTokens,
      completionTokens,
      estimatedCostUsd: estimatedCostUsd !== null ? String(estimatedCostUsd) : null,
    });

    return { ok: true, estimatedCostUsd };
  });

  app.get('/usage', async (req) => {
    const query = req.query as { projectId?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);

    const rows = query.projectId
      ? await db
          .select()
          .from(schema.usageLogs)
          .where(eq(schema.usageLogs.projectId, query.projectId))
          .orderBy(desc(schema.usageLogs.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(schema.usageLogs)
          .orderBy(desc(schema.usageLogs.createdAt))
          .limit(limit);

    return { logs: rows };
  });
}
