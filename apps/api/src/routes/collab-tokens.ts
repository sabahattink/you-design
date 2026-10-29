import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  IssueCollabTokenBody,
  resolveCollabTokenTtl,
  type CollabRole,
  type CollabTokenResponseType,
} from '@you-design/shared';
import { signCollabToken } from '@you-design/shared/collab-token';
import type { CollabTokenStore } from '../lib/collab-token-store.js';

export interface CollabTokenRoutesOptions {
  secret: string;
  store: CollabTokenStore;
  /** Epoch-ms clock; injectable for tests. */
  now?: () => number;
}

const ProjectParams = z.object({ id: z.string().uuid() });

/**
 * M5c — issues HMAC-signed collab capability tokens and revokes them by
 * bumping the project's token version.
 *
 * Like every other REST route these are unauthenticated: the API is the
 * owner's trusted surface (see the M5c spec, §1). Tokens appear only in
 * response bodies, which Fastify does not log.
 */
export async function collabTokenRoutes(
  app: FastifyInstance,
  opts: CollabTokenRoutesOptions,
): Promise<void> {
  const now = opts.now ?? Date.now;

  const mint = (projectId: string, role: CollabRole, version: number, ttlSeconds?: number) => {
    const { token, claims } = signCollabToken(
      {
        projectId,
        role,
        version,
        ttlSeconds: resolveCollabTokenTtl(role, ttlSeconds),
        now: now(),
      },
      opts.secret,
    );
    const response: CollabTokenResponseType = {
      token,
      role,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
    };
    return response;
  };

  const parseProjectId = (params: unknown, reply: FastifyReply): string | null => {
    const parsed = ProjectParams.safeParse(params);
    if (!parsed.success) {
      reply.code(400);
      return null;
    }
    return parsed.data.id;
  };

  app.post('/projects/:id/collab-tokens', async (req, reply) => {
    const projectId = parseProjectId(req.params, reply);
    if (!projectId) return { error: 'INVALID_PROJECT_ID' };

    const body = IssueCollabTokenBody.safeParse(req.body ?? {});
    if (!body.success) {
      reply.code(400);
      return { error: 'INVALID_BODY', message: body.error.message };
    }

    const version = await opts.store.getTokenVersion(projectId);
    if (version === null) {
      reply.code(404);
      return { error: 'NOT_FOUND' };
    }

    reply.code(201).header('cache-control', 'no-store');
    return mint(projectId, body.data.role, version, body.data.ttlSeconds);
  });

  app.post('/projects/:id/collab-tokens/revoke', async (req, reply) => {
    const projectId = parseProjectId(req.params, reply);
    if (!projectId) return { error: 'INVALID_PROJECT_ID' };

    const version = await opts.store.bumpTokenVersion(projectId);
    if (version === null) {
      reply.code(404);
      return { error: 'NOT_FOUND' };
    }

    req.log.info({ projectId, version }, 'collab tokens revoked');
    reply.header('cache-control', 'no-store');
    return mint(projectId, 'owner', version);
  });
}
