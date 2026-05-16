import type { FastifyInstance } from 'fastify';
import { eq, desc, sql } from 'drizzle-orm';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { db, schema } from '@you-design/db';
import {
  CreateProjectBody,
  ProjectPatch,
  MemoryStoreBody,
} from '@you-design/shared';

export async function projectsRoutes(app: FastifyInstance) {
  // GET /projects
  app.get('/projects', async () => {
    const rows = await db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        intentPhase: schema.projects.intentPhase,
        updatedAt: schema.projects.updatedAt,
        pageCount: sql<number>`cast(count(${schema.projectPages.id}) as int)`,
      })
      .from(schema.projects)
      .leftJoin(schema.projectPages, eq(schema.projectPages.projectId, schema.projects.id))
      .groupBy(schema.projects.id)
      .orderBy(desc(schema.projects.updatedAt));

    return {
      projects: rows.map((r) => ({
        ...r,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  });

  // POST /projects
  app.post('/projects', async (req, reply) => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const [project] = await db
      .insert(schema.projects)
      .values({ name: parsed.data.name })
      .returning();
    reply.code(201);
    return {
      project: {
        id: project!.id,
        name: project!.name,
        intentPhase: project!.intentPhase,
        pageCount: 0,
        updatedAt: project!.updatedAt.toISOString(),
      },
    };
  });

  // GET /projects/:id
  app.get('/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id));
    if (!project) {
      reply.code(404);
      return { error: 'NOT_FOUND' };
    }
    const pages = await db
      .select()
      .from(schema.projectPages)
      .where(eq(schema.projectPages.projectId, id));
    return {
      project: {
        id: project.id,
        name: project.name,
        intentPhase: project.intentPhase,
        intentContract: project.intentContract,
        pageCount: pages.length,
        updatedAt: project.updatedAt.toISOString(),
        pages: pages.map((p) => ({ path: p.path, title: p.title, html: p.html })),
      },
    };
  });

  // PATCH /projects/:id
  app.patch('/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ProjectPatch.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const patch = parsed.data;

    const projectUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) projectUpdate.name = patch.name;
    if (patch.intentPhase !== undefined) projectUpdate.intentPhase = patch.intentPhase;
    if (patch.intentContract !== undefined) projectUpdate.intentContract = patch.intentContract;

    await db.update(schema.projects).set(projectUpdate).where(eq(schema.projects.id, id));

    if (patch.pages && patch.pages.length > 0) {
      for (const page of patch.pages) {
        await db
          .insert(schema.projectPages)
          .values({ projectId: id, path: page.path, title: page.title, html: page.html })
          .onConflictDoUpdate({
            target: [schema.projectPages.projectId, schema.projectPages.path],
            set: { title: page.title, html: page.html, updatedAt: new Date() },
          });
      }
    }

    return { ok: true };
  });

  // DELETE /projects/:id
  app.delete('/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
    return { ok: true };
  });

  // POST /projects/:id/memories
  app.post('/projects/:id/memories', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = MemoryStoreBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: parsed.error.message };
    }
    const { summary, openAiKey } = parsed.data;

    let embedding: number[] | null = null;
    if (openAiKey) {
      try {
        const openai = createOpenAI({ apiKey: openAiKey });
        const result = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: summary,
        });
        embedding = result.embedding;
      } catch {
        // embedding failed — store summary without vector
      }
    }

    await db.insert(schema.projectMemories).values({ projectId: id, summary, embedding });
    return { ok: true };
  });

  // GET /projects/:id/memories/search
  app.get('/projects/:id/memories/search', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { q?: string; openAiKey?: string };

    if (!query.q) {
      reply.code(400);
      return { error: 'MISSING_QUERY' };
    }

    if (query.openAiKey) {
      try {
        const openai = createOpenAI({ apiKey: query.openAiKey });
        const result = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: query.q,
        });
        const queryVec = `[${result.embedding.join(',')}]`;
        const rows = (await db.execute(
          sql`SELECT summary FROM project_memories
              WHERE project_id = ${id} AND embedding IS NOT NULL
              ORDER BY embedding <=> ${queryVec}::vector
              LIMIT 3`,
        )) as unknown as Array<{ summary: string }>;
        return { memories: rows.map((r) => r.summary) };
      } catch {
        // fall through to recency-based
      }
    }

    const rows = await db
      .select({ summary: schema.projectMemories.summary })
      .from(schema.projectMemories)
      .where(eq(schema.projectMemories.projectId, id))
      .orderBy(desc(schema.projectMemories.createdAt))
      .limit(3);

    return { memories: rows.map((r) => r.summary) };
  });
}
