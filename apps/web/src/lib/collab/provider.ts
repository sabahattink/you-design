import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface ProviderBundle {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  persistence: IndexeddbPersistence;
}

const COLLAB_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_COLLAB_URL) ||
  'ws://localhost:3002';

export function createProvider(projectId: string): ProviderBundle {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`you-design.project.${projectId}`, doc);
  const provider = new HocuspocusProvider({
    url: COLLAB_URL,
    name: projectId,
    document: doc,
    connect: true,
  });
  return { doc, provider, persistence };
}
