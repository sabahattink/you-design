import {
  decodeCollabTokenClaims,
  type CollabRole,
  type CollabTokenClaims,
} from '@you-design/shared';
import { issueCollabToken } from '@/lib/projects/api';

// M5c token vault.
// - Share tokens arrive in a link (#share=…) and live in sessionStorage for the
//   tab session, so a bookmarked link keeps working but nothing lingers at
//   rest across browser restarts.
// - Owner tokens are minted on demand from the (trusted, owner-local) API and
//   held in memory only.
// A project joined through a share link never falls back to minting an owner
// token, so a guest whose link expired is told so instead of being upgraded.
// Claims are decoded WITHOUT verification — for UX only; apps/collab decides.

const SHARE_STORAGE_KEY = 'you-design.collab.share-tokens.v1';
/** Owner tokens are re-minted when less than this remains. */
export const OWNER_TOKEN_REFRESH_MARGIN_MS = 60_000;

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string')
  );
}

export type CollabTokenErrorReason = 'share-link-expired' | 'owner-token-unavailable';

export class CollabTokenError extends Error {
  readonly reason: CollabTokenErrorReason;

  constructor(reason: CollabTokenErrorReason) {
    super(reason);
    this.name = 'CollabTokenError';
    this.reason = reason;
  }
}

export interface CollabTokenVaultDeps {
  storage: () => Storage | null;
  mintOwnerToken: (projectId: string) => Promise<string>;
  /** Epoch ms. */
  now: () => number;
}

export interface CollabTokenVault {
  /** Stores a token from a share link. Returns its claims, or null if unusable. */
  rememberShareToken(projectId: string, token: string): CollabTokenClaims | null;
  /** Caches an owner token (e.g. the one a revoke returns). */
  rememberOwnerToken(projectId: string, token: string): void;
  /** Role granted by this tab's share link for the project, if any. */
  shareRole(projectId: string): CollabRole | null;
  /** Token to present to apps/collab. Throws CollabTokenError. */
  resolve(projectId: string): Promise<string>;
}

interface HeldToken {
  token: string;
  claims: CollabTokenClaims;
}

export function createCollabTokenVault(deps: CollabTokenVaultDeps): CollabTokenVault {
  const ownerTokens = new Map<string, HeldToken>();

  const hold = (projectId: string, token: string): HeldToken | null => {
    const claims = decodeCollabTokenClaims(token);
    return claims && claims.pid === projectId ? { token, claims } : null;
  };

  const msLeft = (held: HeldToken): number => held.claims.exp * 1000 - deps.now();

  const readShareTokens = (): Record<string, string> => {
    try {
      const raw = deps.storage()?.getItem(SHARE_STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return isStringRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeShareTokens = (next: Record<string, string>): void => {
    try {
      deps.storage()?.setItem(SHARE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode / quota) — the link still works for
      // this page load because resolve() reads the same storage; nothing else
      // to do.
    }
  };

  return {
    rememberShareToken(projectId, token) {
      const held = hold(projectId, token);
      if (!held) return null;
      writeShareTokens({ ...readShareTokens(), [projectId]: token });
      return held.claims;
    },

    rememberOwnerToken(projectId, token) {
      const held = hold(projectId, token);
      if (held) ownerTokens.set(projectId, held);
    },

    shareRole(projectId) {
      const token = readShareTokens()[projectId];
      return token ? (hold(projectId, token)?.claims.role ?? null) : null;
    },

    async resolve(projectId) {
      const shareToken = readShareTokens()[projectId];
      if (shareToken !== undefined) {
        const held = hold(projectId, shareToken);
        if (held && msLeft(held) > 0) return held.token;
        throw new CollabTokenError('share-link-expired');
      }

      const cached = ownerTokens.get(projectId);
      if (cached && msLeft(cached) > OWNER_TOKEN_REFRESH_MARGIN_MS) return cached.token;

      let minted: string;
      try {
        minted = await deps.mintOwnerToken(projectId);
      } catch {
        throw new CollabTokenError('owner-token-unavailable');
      }
      const held = hold(projectId, minted);
      if (!held) throw new CollabTokenError('owner-token-unavailable');
      ownerTokens.set(projectId, held);
      return held.token;
    },
  };
}

/** App-wide vault. */
export const collabTokens: CollabTokenVault = createCollabTokenVault({
  storage: () => (typeof window === 'undefined' ? null : window.sessionStorage),
  mintOwnerToken: async (projectId) => (await issueCollabToken(projectId, 'owner')).token,
  now: () => Date.now(),
});
