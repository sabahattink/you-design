// Node-only: imported as `@you-design/shared/collab-token` by apps/api and
// apps/collab. Never import this from browser code.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  COLLAB_TOKEN_PREFIX,
  COLLAB_TOKEN_SECRET_MIN_LENGTH,
  CollabRole,
  CollabTokenTtlSeconds,
  parseCollabTokenPayload,
  splitCollabToken,
  type CollabTokenClaims,
} from './collab.js';

const HMAC_ALGORITHM = 'sha256';
const SIGNATURE_BYTES = 32;

export type CollabTokenRejection = 'malformed' | 'bad-signature' | 'expired' | 'wrong-project';

export type CollabTokenVerification =
  | { ok: true; claims: CollabTokenClaims }
  | { ok: false; reason: CollabTokenRejection };

const SignInput = z.object({
  projectId: z.string().uuid(),
  role: CollabRole,
  version: z.number().int().nonnegative(),
  ttlSeconds: CollabTokenTtlSeconds,
  /** Epoch milliseconds. */
  now: z.number().int().nonnegative(),
});
export type SignCollabTokenInput = z.input<typeof SignInput>;

export interface VerifyCollabTokenOptions {
  secret: string;
  /** The project the caller is trying to access (Hocuspocus documentName). */
  projectId: string;
  /** Epoch milliseconds. */
  now: number;
}

function assertSecret(secret: string): void {
  if (secret.length < COLLAB_TOKEN_SECRET_MIN_LENGTH) {
    throw new Error(
      `COLLAB_TOKEN_SECRET must be at least ${COLLAB_TOKEN_SECRET_MIN_LENGTH} characters`,
    );
  }
}

function hmac(secret: string, signingInput: string): Buffer {
  return createHmac(HMAC_ALGORITHM, secret).update(signingInput, 'utf8').digest();
}

export function signCollabToken(
  input: SignCollabTokenInput,
  secret: string,
): { token: string; claims: CollabTokenClaims } {
  assertSecret(secret);
  const parsed = SignInput.safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid collab token input (ttl/role/projectId): ${parsed.error.message}`);
  }
  const { projectId, role, version, ttlSeconds, now } = parsed.data;
  const iat = Math.floor(now / 1000);
  const claims: CollabTokenClaims = {
    v: 1,
    pid: projectId,
    role,
    iat,
    exp: iat + ttlSeconds,
    ver: version,
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signingInput = `${COLLAB_TOKEN_PREFIX}.${payload}`;
  const signature = hmac(secret, signingInput).toString('base64url');
  return { token: `${signingInput}.${signature}`, claims };
}

/**
 * Verifies shape → signature (constant time) → claims → expiry → project.
 * The token version (`ver`) is checked by the caller against the database.
 */
export function verifyCollabToken(
  token: string,
  options: VerifyCollabTokenOptions,
): CollabTokenVerification {
  assertSecret(options.secret);
  const parts = splitCollabToken(token);
  if (!parts) return { ok: false, reason: 'malformed' };

  const expected = hmac(options.secret, parts.signingInput);
  const provided = Buffer.from(parts.signature, 'base64url');
  // Length is not secret (always 32 for a genuine token); timingSafeEqual
  // requires equal lengths.
  if (provided.length !== SIGNATURE_BYTES || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const claims = parseCollabTokenPayload(parts.payload);
  if (!claims) return { ok: false, reason: 'malformed' };
  if (Math.floor(options.now / 1000) >= claims.exp) return { ok: false, reason: 'expired' };
  if (claims.pid !== options.projectId) return { ok: false, reason: 'wrong-project' };

  return { ok: true, claims };
}
