import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
});

export async function projectsRoutes(app: FastifyInstance) {
  app.get(
    '/projects',
    {
      schema: {
        response: { 200: z.object({ items: z.array(ProjectSchema) }) },
      },
    },
    async () => ({ items: [] }),
  );

  app.post(
    '/projects',
    {
      schema: {
        body: z.object({ name: z.string().min(1).max(120) }),
      },
    },
    async (req, reply) => {
      reply.code(501);
      return { error: 'Not Implemented — M1 milestone', body: req.body };
    },
  );
}
