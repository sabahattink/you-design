import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyCollabToken } from '@you-design/shared/collab-token';
import { CollabTokenResponse } from '@you-design/shared';
import type { CollabTokenStore } from '../lib/collab-token-store.js';
import { collabTokenRoutes } from './collab-tokens.js';

const SECRET = 'api-test-secret-at-least-32-characters!!';
const PROJECT = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';
const MISSING = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

function memoryStore(initial: Record<string, number>): CollabTokenStore & {
  versions: Map<string, number>;
} {
  const versions = new Map(Object.entries(initial));
  return {
    versions,
    async getTokenVersion(projectId) {
      return versions.get(projectId) ?? null;
    },
    async bumpTokenVersion(projectId) {
      const current = versions.get(projectId);
      if (current === undefined) return null;
      versions.set(projectId, current + 1);
      return current + 1;
    },
  };
}

let app: FastifyInstance;
let store: ReturnType<typeof memoryStore>;

beforeEach(async () => {
  store = memoryStore({ [PROJECT]: 2 });
  app = Fastify();
  await app.register(collabTokenRoutes, {
    prefix: '/api/v1',
    secret: SECRET,
    store,
    now: () => NOW,
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function issue(projectId: string, body: unknown) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/projects/${projectId}/collab-tokens`,
    payload: body as Record<string, unknown>,
  });
}

describe('POST /projects/:id/collab-tokens', () => {
  it.each([
    ['owner', 12 * 3600],
    ['edit', 7 * 24 * 3600],
    ['view', 7 * 24 * 3600],
  ] as const)('issues a %s token with the role default TTL', async (role, ttl) => {
    const res = await issue(PROJECT, { role });
    expect(res.statusCode).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');

    const body = CollabTokenResponse.parse(res.json());
    expect(body.role).toBe(role);
    expect(body.expiresAt).toBe(new Date(NOW + ttl * 1000).toISOString());

    const verified = verifyCollabToken(body.token, {
      secret: SECRET,
      projectId: PROJECT,
      now: NOW,
    });
    expect(verified).toEqual({
      ok: true,
      claims: expect.objectContaining({ pid: PROJECT, role, ver: 2 }),
    });
  });

  it('honours an explicit ttlSeconds', async () => {
    const res = await issue(PROJECT, { role: 'view', ttlSeconds: 3600 });
    expect(res.statusCode).toBe(201);
    expect(CollabTokenResponse.parse(res.json()).expiresAt).toBe(
      new Date(NOW + 3600 * 1000).toISOString(),
    );
  });

  it.each([
    ['unknown role', { role: 'admin' }],
    ['missing role', {}],
    ['ttl too short', { role: 'edit', ttlSeconds: 10 }],
    ['ttl too long', { role: 'edit', ttlSeconds: 31 * 24 * 3600 }],
    ['extra field', { role: 'edit', projectId: MISSING }],
  ])('rejects an invalid body (%s) with 400', async (_label, body) => {
    const res = await issue(PROJECT, body);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'INVALID_BODY' });
  });

  it('rejects a non-UUID project id with 400', async () => {
    const res = await issue('not-a-uuid', { role: 'edit' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'INVALID_PROJECT_ID' });
  });

  it('returns 404 for an unknown project', async () => {
    const res = await issue(MISSING, { role: 'edit' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'NOT_FOUND' });
  });
});

describe('POST /projects/:id/collab-tokens/revoke', () => {
  it('bumps the version and returns a fresh owner token under it', async () => {
    const before = CollabTokenResponse.parse((await issue(PROJECT, { role: 'edit' })).json());

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${PROJECT}/collab-tokens/revoke`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(store.versions.get(PROJECT)).toBe(3);

    const after = CollabTokenResponse.parse(res.json());
    expect(after.role).toBe('owner');
    const verifiedAfter = verifyCollabToken(after.token, {
      secret: SECRET,
      projectId: PROJECT,
      now: NOW,
    });
    expect(verifiedAfter.ok && verifiedAfter.claims.ver).toBe(3);

    // The old token still has a valid signature; it is the version mismatch
    // that collab rejects.
    const verifiedBefore = verifyCollabToken(before.token, {
      secret: SECRET,
      projectId: PROJECT,
      now: NOW,
    });
    expect(verifiedBefore.ok && verifiedBefore.claims.ver).toBe(2);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${MISSING}/collab-tokens/revoke`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a non-UUID project id with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/abc/collab-tokens/revoke',
    });
    expect(res.statusCode).toBe(400);
  });
});
