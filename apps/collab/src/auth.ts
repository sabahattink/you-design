import { CollabRole } from '@you-design/shared';
import { verifyCollabToken, type CollabTokenRejection } from '@you-design/shared/collab-token';
import { z } from 'zod';

/** Returns the project's current collab token version, or null if it does not exist. */
export type TokenVersionLookup = (projectId: string) => Promise<number | null>;

export interface AuthLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
  debug(obj: Record<string, unknown>, msg: string): void;
}

/** Reason strings Hocuspocus forwards to the client on rejection. */
export type CollabDenyReason =
  | 'invalid-token'
  | 'token-expired'
  | 'token-revoked'
  | 'project-not-found';

// Hocuspocus convention: 4401 Unauthorized, 4403 Forbidden.
const CLOSE_CODES: Record<CollabDenyReason, number> = {
  'invalid-token': 4401,
  'token-expired': 4401,
  'token-revoked': 4403,
  'project-not-found': 4403,
};

/**
 * Thrown from Hocuspocus hooks. Hocuspocus reads `reason` (permission-denied
 * message on join) and `code` + `reason` (close frame from
 * `beforeHandleMessage`). Never put token material in here.
 */
export class CollabAccessError extends Error {
  readonly reason: CollabDenyReason;
  readonly code: number;

  constructor(reason: CollabDenyReason) {
    super(reason);
    this.name = 'CollabAccessError';
    this.reason = reason;
    this.code = CLOSE_CODES[reason];
  }
}

export const CollabAuthContext = z.object({
  projectId: z.string().uuid(),
  role: CollabRole,
  exp: z.number().int(),
  ver: z.number().int().nonnegative(),
});
export type CollabAuthContext = z.infer<typeof CollabAuthContext>;

/** The subset of Hocuspocus' onAuthenticate payload this module uses. */
export interface AuthenticatePayload {
  documentName: string;
  token: string;
  socketId: string;
  connection: { readOnly: boolean };
}

/** The subset of Hocuspocus' beforeHandleMessage payload this module uses. */
export interface MessageGuardPayload {
  context: unknown;
  documentName: string;
  socketId: string;
}

interface AuthDeps {
  secret: string;
  lookupVersion: TokenVersionLookup;
  logger: AuthLogger;
  /** Epoch-ms clock; injectable for tests. */
  now?: () => number;
}

const VERIFY_TO_DENY: Record<CollabTokenRejection, CollabDenyReason> = {
  // Shape / signature / project mismatch are not distinguished for the client.
  malformed: 'invalid-token',
  'bad-signature': 'invalid-token',
  'wrong-project': 'invalid-token',
  expired: 'token-expired',
};

/**
 * Hocuspocus `onAuthenticate`: the token must be a valid, unexpired
 * capability for exactly this document (project) at the project's current
 * token version. View tokens make the connection read-only.
 */
export function createAuthenticator(
  deps: AuthDeps,
): (payload: AuthenticatePayload) => Promise<CollabAuthContext> {
  const now = deps.now ?? Date.now;

  return async ({ documentName, token, socketId, connection }) => {
    const deny = (reason: CollabDenyReason, detail: string): never => {
      deps.logger.warn({ documentName, socketId, reason, detail }, 'collab join rejected');
      throw new CollabAccessError(reason);
    };

    const result = verifyCollabToken(token, {
      secret: deps.secret,
      projectId: documentName,
      now: now(),
    });
    if (!result.ok) return deny(VERIFY_TO_DENY[result.reason], result.reason);

    const { claims } = result;
    const currentVersion = await deps.lookupVersion(claims.pid);
    if (currentVersion === null) return deny('project-not-found', 'project-not-found');
    if (claims.ver !== currentVersion) return deny('token-revoked', 'version-mismatch');

    if (claims.role === 'view') {
      // Hocuspocus API: mutate the connection config to make it read-only.
      connection.readOnly = true;
    }

    deps.logger.debug({ documentName, socketId, role: claims.role }, 'collab join accepted');
    return { projectId: claims.pid, role: claims.role, exp: claims.exp, ver: claims.ver };
  };
}

/**
 * Hocuspocus `beforeHandleMessage`: WebSockets are long-lived, so expiry and
 * revocation are re-checked on every message. Pair `lookupVersion` with
 * `cacheVersionLookup` — this runs for every cursor move.
 */
export function createMessageGuard(
  deps: Omit<AuthDeps, 'secret'>,
): (payload: MessageGuardPayload) => Promise<void> {
  const now = deps.now ?? Date.now;

  return async ({ context, documentName, socketId }) => {
    const deny = (reason: CollabDenyReason): never => {
      deps.logger.warn({ documentName, socketId, reason }, 'collab connection closed');
      throw new CollabAccessError(reason);
    };

    const parsed = CollabAuthContext.safeParse(context);
    if (!parsed.success || parsed.data.projectId !== documentName) return deny('invalid-token');

    const { exp, ver, projectId } = parsed.data;
    if (Math.floor(now() / 1000) >= exp) return deny('token-expired');

    const currentVersion = await deps.lookupVersion(projectId);
    if (currentVersion === null) return deny('project-not-found');
    if (currentVersion !== ver) return deny('token-revoked');
  };
}

/** Memoises version lookups per project for `ttlMs` (failures are not cached). */
export function cacheVersionLookup(
  lookup: TokenVersionLookup,
  ttlMs: number,
  now: () => number = Date.now,
): TokenVersionLookup {
  const cache = new Map<string, { value: number | null; expiresAt: number }>();
  return async (projectId) => {
    const hit = cache.get(projectId);
    if (hit && now() < hit.expiresAt) return hit.value;
    const value = await lookup(projectId);
    cache.set(projectId, { value, expiresAt: now() + ttlMs });
    return value;
  };
}
