import { z } from 'zod';

// -----------------------------------------------------------------------------
// Collab capability tokens (M5c) — browser-safe part.
//
// Format: `yd1.<base64url(JSON claims)>.<base64url(HMAC-SHA256)>`.
// Signing + verification live in `./collab-token.ts` (Node-only, exported as
// `@you-design/shared/collab-token`) so `node:crypto` never reaches the web
// bundle. This module holds the schemas the API and web share, plus an
// UNVERIFIED decoder the web uses for display only.
// -----------------------------------------------------------------------------

export const COLLAB_TOKEN_PREFIX = 'yd1';
export const COLLAB_TOKEN_MAX_LENGTH = 1024;
export const COLLAB_TOKEN_SECRET_MIN_LENGTH = 32;

export const COLLAB_TOKEN_TTL = {
  minSeconds: 5 * 60,
  maxSeconds: 30 * 24 * 3600,
  ownerDefaultSeconds: 12 * 3600,
  shareDefaultSeconds: 7 * 24 * 3600,
} as const;

export const CollabRole = z.enum(['owner', 'edit', 'view']);
export type CollabRole = z.infer<typeof CollabRole>;

export const ShareRole = z.enum(['edit', 'view']);
export type ShareRole = z.infer<typeof ShareRole>;

export const CollabTokenClaims = z
  .object({
    v: z.literal(1),
    pid: z.string().uuid(),
    role: CollabRole,
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    ver: z.number().int().nonnegative(),
  })
  .strict();
export type CollabTokenClaims = z.infer<typeof CollabTokenClaims>;

export const CollabTokenTtlSeconds = z
  .number()
  .int()
  .min(COLLAB_TOKEN_TTL.minSeconds)
  .max(COLLAB_TOKEN_TTL.maxSeconds);

export const IssueCollabTokenBody = z
  .object({
    role: CollabRole,
    ttlSeconds: CollabTokenTtlSeconds.optional(),
  })
  .strict();
export type IssueCollabTokenBodyType = z.infer<typeof IssueCollabTokenBody>;

export const CollabTokenResponse = z.object({
  token: z.string().min(1).max(COLLAB_TOKEN_MAX_LENGTH),
  role: CollabRole,
  expiresAt: z.string().datetime(),
});
export type CollabTokenResponseType = z.infer<typeof CollabTokenResponse>;

export function resolveCollabTokenTtl(role: CollabRole, ttlSeconds?: number): number {
  if (ttlSeconds !== undefined) return ttlSeconds;
  return role === 'owner'
    ? COLLAB_TOKEN_TTL.ownerDefaultSeconds
    : COLLAB_TOKEN_TTL.shareDefaultSeconds;
}

export interface CollabTokenParts {
  /** `yd1.<payload>` — the exact bytes the HMAC covers. */
  signingInput: string;
  payload: string;
  signature: string;
}

const TOKEN_SHAPE = /^yd1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

/** Shape check only (prefix, three base64url segments, length cap). */
export function splitCollabToken(token: string): CollabTokenParts | null {
  if (token.length === 0 || token.length > COLLAB_TOKEN_MAX_LENGTH) return null;
  const match = TOKEN_SHAPE.exec(token);
  const payload = match?.[1];
  const signature = match?.[2];
  if (!payload || !signature) return null;
  return { signingInput: `${COLLAB_TOKEN_PREFIX}.${payload}`, payload, signature };
}

function base64UrlToUtf8(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Parse + validate a payload segment. Does NOT check the signature. */
export function parseCollabTokenPayload(payload: string): CollabTokenClaims | null {
  try {
    const parsed = CollabTokenClaims.safeParse(JSON.parse(base64UrlToUtf8(payload)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * UNVERIFIED decode for UI hints (role, expiry). Never use the result for an
 * access decision — only the collab server, which holds the secret, can.
 */
export function decodeCollabTokenClaims(token: string): CollabTokenClaims | null {
  const parts = splitCollabToken(token);
  return parts ? parseCollabTokenPayload(parts.payload) : null;
}
