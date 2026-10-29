import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface ProviderBundle {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  persistence: IndexeddbPersistence;
}

const COLLAB_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_COLLAB_URL) || 'ws://localhost:3002';

export interface ProviderOptions {
  /**
   * Resolves the collab capability token (M5c). Called on every (re)connect;
   * a rejection makes the provider emit `authenticationFailed` and stop.
   */
  token: () => Promise<string>;
}

export function createProvider(projectId: string, options: ProviderOptions): ProviderBundle {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`you-design.project.${projectId}`, doc);
  const provider = new HocuspocusProvider({
    url: COLLAB_URL,
    name: projectId,
    document: doc,
    token: options.token,
    connect: true,
  });
  return { doc, provider, persistence };
}
