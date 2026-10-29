import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signCollabToken, verifyCollabToken } from './collab-token.js';
import { COLLAB_TOKEN_PREFIX, decodeCollabTokenClaims, resolveCollabTokenTtl } from './collab.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const PROJECT = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';
const OTHER_PROJECT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

function issue(overrides: Partial<Parameters<typeof signCollabToken>[0]> = {}) {
  return signCollabToken(
    { projectId: PROJECT, role: 'edit', version: 0, ttlSeconds: 3600, now: NOW, ...overrides },
    SECRET,
  );
}

function tamper(token: string, part: 1 | 2): string {
  const parts = token.split('.');
  const target = parts[part] ?? '';
  const flipped = (target[0] === 'A' ? 'B' : 'A') + target.slice(1);
  parts[part] = flipped;
  return parts.join('.');
}

describe('signCollabToken', () => {
  it('produces a yd1.<payload>.<signature> token with the expected claims', () => {
    const { token, claims } = issue({ role: 'view', version: 3 });
    expect(token.split('.')).toHaveLength(3);
    expect(token.startsWith(`${COLLAB_TOKEN_PREFIX}.`)).toBe(true);
    expect(claims).toEqual({
      v: 1,
      pid: PROJECT,
      role: 'view',
      iat: NOW / 1000,
      exp: NOW / 1000 + 3600,
      ver: 3,
    });
  });

  it('refuses a short secret', () => {
    expect(() =>
      signCollabToken(
        { projectId: PROJECT, role: 'edit', version: 0, ttlSeconds: 3600, now: NOW },
        'too-short',
      ),
    ).toThrow(/at least 32/);
  });

  it('refuses a TTL outside the allowed bounds', () => {
    expect(() => issue({ ttlSeconds: 10 })).toThrow(/ttl/i);
    expect(() => issue({ ttlSeconds: 31 * 24 * 3600 })).toThrow(/ttl/i);
  });

  it('refuses a non-UUID project id', () => {
    expect(() => issue({ projectId: 'not-a-uuid' })).toThrow();
  });
});

describe('verifyCollabToken', () => {
  const verify = (
    token: string,
    opts: { projectId?: string; now?: number; secret?: string } = {},
  ) =>
    verifyCollabToken(token, {
      secret: opts.secret ?? SECRET,
      projectId: opts.projectId ?? PROJECT,
      now: opts.now ?? NOW,
    });

  it('accepts a freshly signed token and returns its claims', () => {
    const { token, claims } = issue();
    expect(verify(token)).toEqual({ ok: true, claims });
  });

  it('rejects a token signed with a different secret', () => {
    const { token } = issue();
    expect(verify(token, { secret: `${SECRET}-other` })).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('rejects a tampered payload or signature', () => {
    const { token } = issue();
    expect(verify(tamper(token, 1))).toEqual({ ok: false, reason: 'bad-signature' });
    expect(verify(tamper(token, 2))).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a payload re-signed claim swap (view -> edit) without the secret', () => {
    const view = issue({ role: 'view' }).token;
    const edit = issue({ role: 'edit' }).token;
    const [prefix, , viewSig] = view.split('.');
    const [, editPayload] = edit.split('.');
    expect(verify(`${prefix}.${editPayload}.${viewSig}`)).toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('rejects a token at and after its expiry instant', () => {
    const { token } = issue({ ttlSeconds: 300 });
    expect(verify(token, { now: NOW + 299_000 }).ok).toBe(true);
    expect(verify(token, { now: NOW + 300_000 })).toEqual({ ok: false, reason: 'expired' });
    expect(verify(token, { now: NOW + 900_000 })).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a token for another project', () => {
    const { token } = issue();
    expect(verify(token, { projectId: OTHER_PROJECT })).toEqual({
      ok: false,
      reason: 'wrong-project',
    });
  });

  it.each([
    ['empty', ''],
    ['wrong prefix', 'yd2.abc.def'],
    ['two parts', 'yd1.abc'],
    ['four parts', 'yd1.a.b.c'],
    ['non-base64url chars', 'yd1.ab+c.de/f'],
    ['whitespace', 'yd1.abc .def'],
    ['oversized', `yd1.${'a'.repeat(2048)}.abc`],
  ])('rejects a malformed token (%s)', (_label, token) => {
    expect(verify(token)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects a signature of the wrong length', () => {
    const { token } = issue();
    const [prefix, payload] = token.split('.');
    expect(verify(`${prefix}.${payload}.AAAA`)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a correctly signed payload that is not a valid claim set', () => {
    // Sign arbitrary JSON with the real secret: the signature passes, Zod must not.
    const forged = signRaw({ v: 1, pid: PROJECT, role: 'admin', iat: 1, exp: 9e9, ver: 0 });
    expect(verify(forged)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('decodeCollabTokenClaims (unverified, UI only)', () => {
  it('decodes claims without the secret', () => {
    const { token, claims } = issue({ role: 'view' });
    expect(decodeCollabTokenClaims(token)).toEqual(claims);
  });

  it('returns null for garbage', () => {
    expect(decodeCollabTokenClaims('nope')).toBeNull();
    expect(decodeCollabTokenClaims('yd1.e30.abc')).toBeNull(); // "{}"
  });
});

describe('resolveCollabTokenTtl', () => {
  it('defaults per role and clamps nothing silently', () => {
    expect(resolveCollabTokenTtl('owner')).toBe(12 * 3600);
    expect(resolveCollabTokenTtl('edit')).toBe(7 * 24 * 3600);
    expect(resolveCollabTokenTtl('view', 600)).toBe(600);
  });
});

// Test helper: sign an arbitrary payload exactly like signCollabToken does.
function signRaw(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${COLLAB_TOKEN_PREFIX}.${body}`;
  const sig = createHmac('sha256', SECRET).update(input).digest('base64url');
  return `${input}.${sig}`;
}
