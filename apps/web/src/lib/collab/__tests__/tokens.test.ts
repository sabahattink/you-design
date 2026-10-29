import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollabRole } from '@you-design/shared';
import { CollabTokenError, createCollabTokenVault, type CollabTokenVault } from '../tokens.js';

const PROJECT = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';
const OTHER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

// Unsigned stand-in: the web never verifies signatures, it only decodes claims.
function fakeToken(role: CollabRole, opts: { pid?: string; expInSeconds?: number } = {}): string {
  const iat = NOW / 1000;
  const claims = {
    v: 1,
    pid: opts.pid ?? PROJECT,
    role,
    iat,
    exp: iat + (opts.expInSeconds ?? 3600),
    ver: 0,
  };
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `yd1.${payload}.c2lnbmF0dXJl`;
}

let clock: number;
let mint: ReturnType<typeof vi.fn<(projectId: string) => Promise<string>>>;
let vault: CollabTokenVault;

beforeEach(() => {
  sessionStorage.clear();
  clock = NOW;
  mint = vi.fn(async () => fakeToken('owner'));
  vault = createCollabTokenVault({
    storage: () => sessionStorage,
    mintOwnerToken: mint,
    now: () => clock,
  });
});

async function resolveError(projectId: string): Promise<CollabTokenError> {
  try {
    await vault.resolve(projectId);
  } catch (err) {
    if (err instanceof CollabTokenError) return err;
    throw err;
  }
  throw new Error('expected resolve to fail');
}

describe('owner path (no share link)', () => {
  it('mints an owner token from the API and caches it', async () => {
    const first = await vault.resolve(PROJECT);
    const second = await vault.resolve(PROJECT);
    expect(first).toBe(second);
    expect(mint).toHaveBeenCalledTimes(1);
    expect(mint).toHaveBeenCalledWith(PROJECT);
  });

  it('re-mints when the cached owner token is about to expire', async () => {
    await vault.resolve(PROJECT);
    clock = NOW + (3600 - 30) * 1000; // 30 s left, inside the refresh margin
    await vault.resolve(PROJECT);
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it('keeps owner tokens out of web storage', async () => {
    await vault.resolve(PROJECT);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem('you-design.collab.share-tokens.v1')).toBeNull();
  });

  it('reports owner-token-unavailable when the API is unreachable', async () => {
    mint.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect((await resolveError(PROJECT)).reason).toBe('owner-token-unavailable');
  });

  it('rejects a minted token for the wrong project', async () => {
    mint.mockResolvedValueOnce(fakeToken('owner', { pid: OTHER }));
    expect((await resolveError(PROJECT)).reason).toBe('owner-token-unavailable');
  });

  it('uses an owner token handed over by a revoke', async () => {
    const fresh = fakeToken('owner', { expInSeconds: 7200 });
    vault.rememberOwnerToken(PROJECT, fresh);
    expect(await vault.resolve(PROJECT)).toBe(fresh);
    expect(mint).not.toHaveBeenCalled();
  });
});

describe('share path', () => {
  it('stores a share token in sessionStorage and resolves it without minting', async () => {
    const token = fakeToken('view');
    expect(vault.rememberShareToken(PROJECT, token)?.role).toBe('view');
    expect(await vault.resolve(PROJECT)).toBe(token);
    expect(mint).not.toHaveBeenCalled();
    expect(vault.shareRole(PROJECT)).toBe('view');
  });

  it('refuses a share token whose claims name another project', () => {
    expect(vault.rememberShareToken(PROJECT, fakeToken('edit', { pid: OTHER }))).toBeNull();
    expect(vault.shareRole(PROJECT)).toBeNull();
  });

  it('refuses garbage', () => {
    expect(vault.rememberShareToken(PROJECT, 'not-a-token')).toBeNull();
  });

  it('never falls back to minting an owner token once a share link expired', async () => {
    vault.rememberShareToken(PROJECT, fakeToken('edit', { expInSeconds: 600 }));
    clock = NOW + 600_000;
    expect((await resolveError(PROJECT)).reason).toBe('share-link-expired');
    expect(mint).not.toHaveBeenCalled();
  });

  it('survives corrupted storage', async () => {
    sessionStorage.setItem('you-design.collab.share-tokens.v1', '{not json');
    expect(vault.shareRole(PROJECT)).toBeNull();
    expect(await vault.resolve(PROJECT)).toBe(await mint.mock.results[0]?.value);
  });
});
