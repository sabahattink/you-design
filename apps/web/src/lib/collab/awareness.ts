import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { useWorkspaceStore } from '@/lib/workspace/store';
import { getOrCreateIdentity, type Identity } from './identity.js';
import type { RemoteCursor } from './types.js';

type WorkspaceStore = typeof useWorkspaceStore;

interface RawCursorState {
  pagePath: string;
  elementId: string | null;
  x: number | null;
  y: number | null;
}

function normalizeCursor(raw: unknown): RemoteCursor['cursor'] {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RawCursorState>;
  if (typeof r.pagePath !== 'string') return null;
  return {
    pagePath: r.pagePath,
    elementId: typeof r.elementId === 'string' ? r.elementId : null,
    x: typeof r.x === 'number' ? r.x : null,
    y: typeof r.y === 'number' ? r.y : null,
  };
}

function normalizeIdentity(raw: unknown): Identity | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Identity>;
  if (!r.id || !r.displayName || !r.color) return null;
  return { id: r.id, displayName: r.displayName, color: r.color };
}

export function bindAwareness(provider: HocuspocusProvider, store: WorkspaceStore): () => void {
  const awareness = provider.awareness;
  if (!awareness) return () => undefined;

  const identity = getOrCreateIdentity();
  awareness.setLocalStateField('user', identity);

  const publishStoreCursor = () => {
    const s = store.getState();
    awareness.setLocalStateField('cursor', {
      pagePath: s.currentPath,
      elementId: s.selectedElementId,
      x: null,
      y: null,
    } satisfies RawCursorState);
  };
  publishStoreCursor();

  const unsubStore = store.subscribe((next, prev) => {
    if (
      next.currentPath === prev.currentPath &&
      next.selectedElementId === prev.selectedElementId
    ) {
      return;
    }
    publishStoreCursor();
  });

  const onChange = () => {
    const cursors: Record<string, RemoteCursor> = {};
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return;
      const user = normalizeIdentity(state.user);
      if (!user) return;
      cursors[user.id] = {
        user,
        cursor: normalizeCursor(state.cursor),
        isTyping: Boolean(state.isTyping),
      };
    });
    store.getState().setRemoteCursors(cursors);
  };
  awareness.on('change', onChange);
  onChange();

  return () => {
    awareness.off('change', onChange);
    unsubStore();
    store.getState().setRemoteCursors({});
  };
}

export function publishLocalCursor(
  provider: HocuspocusProvider,
  cursor: { pagePath: string; x: number | null; y: number | null },
): void {
  const awareness = provider.awareness;
  if (!awareness) return;
  awareness.setLocalStateField('cursor', {
    pagePath: cursor.pagePath,
    elementId: null,
    x: cursor.x,
    y: cursor.y,
  } satisfies RawCursorState);
}
