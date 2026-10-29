import type { Identity } from './identity.js';

/** `denied`: the collab server (or the token vault) refused access — see M5c. */
export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'denied';

/** Scope the collab server granted after authentication. */
export type CollabAccess = 'read-write' | 'readonly';

export interface RemoteCursor {
  user: Identity;
  cursor: {
    pagePath: string;
    elementId: string | null;
    x: number | null;
    y: number | null;
  } | null;
  isTyping: boolean;
}
