import { describe, expect, it, vi } from 'vitest';
import { signCollabToken } from '@you-design/shared/collab-token';
import type { CollabRole } from '@you-design/shared';
import {
  cacheVersionLookup,
  CollabAccessError,
  createAuthenticator,
  createMessageGuard,
  type AuthLogger,
  type TokenVersionLookup,
} from './auth.js';

const SECRET = 'collab-test-secret-at-least-32-chars!!';
const PROJECT = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';
const OTHER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

function token(role: CollabRole, opts: { version?: number; ttl?: number; pid?: string } = {}) {
  return signCollabToken(
    {
      projectId: opts.pid ?? PROJECT,
      role,
      version: opts.version ?? 0,
      ttlSeconds: opts.ttl ?? 3600,
      now: NOW,
    },
    SECRET,
  ).token;
}

function spyLogger(): AuthLogger & {
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
} {
  return { warn: vi.fn(), debug: vi.fn() };
}

function setup(versions: Record<string, number> = { [PROJECT]: 0 }, now = NOW) {
  const logger = spyLogger();
  const lookupVersion: TokenVersionLookup = vi.fn(async (id: string) => versions[id] ?? null);
  const authenticate = createAuthenticator({
    secret: SECRET,
    lookupVersion,
    logger,
    now: () => now,
  });
  return { authenticate, logger, lookupVersion };
}

function payload(documentName: string, tokenValue: string) {
  return { documentName, token: tokenValue, socketId: 'sock-1', connection: { readOnly: false } };
}

async function rejection(promise: Promise<unknown>): Promise<CollabAccessError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof CollabAccessError) return err;
    throw err;
  }
  throw new Error('expected a rejection');
}

describe('createAuthenticator', () => {
  it.each(['owner', 'edit'] as const)('admits a valid %s token read-write', async (role) => {
    const { authenticate } = setup();
    const p = payload(PROJECT, token(role));
    const ctx = await authenticate(p);
    expect(ctx).toEqual({ projectId: PROJECT, role, exp: NOW / 1000 + 3600, ver: 0 });
    expect(p.connection.readOnly).toBe(false);
  });

  it('admits a view token read-only', async () => {
    const { authenticate } = setup();
    const p = payload(PROJECT, token('view'));
    await authenticate(p);
    expect(p.connection.readOnly).toBe(true);
  });

  it.each([
    ['missing token', ''],
    ['garbage', 'not-a-token'],
    ['bad signature', `${token('edit').slice(0, -2)}AA`],
  ])('rejects %s as invalid-token', async (_label, value) => {
    const { authenticate } = setup();
    const err = await rejection(authenticate(payload(PROJECT, value)));
    expect(err.reason).toBe('invalid-token');
  });

  it('rejects a token minted for another project as invalid-token', async () => {
    const { authenticate } = setup({ [PROJECT]: 0, [OTHER]: 0 });
    const err = await rejection(authenticate(payload(PROJECT, token('edit', { pid: OTHER }))));
    expect(err.reason).toBe('invalid-token');
  });

  it('rejects an expired token as token-expired', async () => {
    const { authenticate } = setup({ [PROJECT]: 0 }, NOW + 3600_000);
    const err = await rejection(authenticate(payload(PROJECT, token('edit'))));
    expect(err.reason).toBe('token-expired');
    expect(err.code).toBe(4401);
  });

  it('rejects a token from before a revoke as token-revoked', async () => {
    const { authenticate } = setup({ [PROJECT]: 1 });
    const err = await rejection(authenticate(payload(PROJECT, token('edit', { version: 0 }))));
    expect(err.reason).toBe('token-revoked');
    expect(err.code).toBe(4403);
  });

  it('rejects a valid token for a deleted project as project-not-found', async () => {
    const { authenticate } = setup({});
    const err = await rejection(authenticate(payload(PROJECT, token('edit'))));
    expect(err.reason).toBe('project-not-found');
  });

  it('does not hit the database for tokens that fail verification', async () => {
    const { authenticate, lookupVersion } = setup();
    await rejection(authenticate(payload(PROJECT, 'garbage')));
    expect(lookupVersion).not.toHaveBeenCalled();
  });

  it('never logs the token', async () => {
    const { authenticate, logger } = setup({ [PROJECT]: 5 });
    const value = token('edit');
    await rejection(authenticate(payload(PROJECT, value)));
    await rejection(authenticate(payload(PROJECT, 'garbage-token-value')));
    const logged = JSON.stringify([...logger.warn.mock.calls, ...logger.debug.mock.calls]);
    expect(logged).not.toContain(value);
    expect(logged).not.toContain('garbage-token-value');
    expect(logged).toContain('token-revoked');
  });
});

describe('createMessageGuard', () => {
  const context = { projectId: PROJECT, role: 'edit', exp: NOW / 1000 + 60, ver: 0 };

  function guard(versions: Record<string, number>, now: number) {
    return createMessageGuard({
      lookupVersion: async (id) => versions[id] ?? null,
      logger: spyLogger(),
      now: () => now,
    });
  }

  it('lets messages through while the token is valid', async () => {
    await expect(
      guard({ [PROJECT]: 0 }, NOW)({ context, documentName: PROJECT, socketId: 's' }),
    ).resolves.toBeUndefined();
  });

  it('closes the connection once the token expires', async () => {
    const err = await rejection(
      guard({ [PROJECT]: 0 }, NOW + 60_000)({ context, documentName: PROJECT, socketId: 's' }),
    );
    expect(err.reason).toBe('token-expired');
  });

  it('closes the connection after a revoke', async () => {
    const err = await rejection(
      guard({ [PROJECT]: 1 }, NOW)({ context, documentName: PROJECT, socketId: 's' }),
    );
    expect(err.reason).toBe('token-revoked');
  });

  it('rejects a connection without an auth context', async () => {
    const err = await rejection(
      guard({ [PROJECT]: 0 }, NOW)({ context: {}, documentName: PROJECT, socketId: 's' }),
    );
    expect(err.reason).toBe('invalid-token');
  });
});

describe('cacheVersionLookup', () => {
  it('serves cached versions within the TTL and refreshes after it', async () => {
    let clock = 0;
    let version = 0;
    const source = vi.fn(async () => version);
    const cached = cacheVersionLookup(source, 10_000, () => clock);

    expect(await cached(PROJECT)).toBe(0);
    version = 1;
    clock = 9_999;
    expect(await cached(PROJECT)).toBe(0);
    expect(source).toHaveBeenCalledTimes(1);

    clock = 10_000;
    expect(await cached(PROJECT)).toBe(1);
    expect(source).toHaveBeenCalledTimes(2);
  });
});
