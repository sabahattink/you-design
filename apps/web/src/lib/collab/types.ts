import type { Identity } from './identity.js';

export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'offline';

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
