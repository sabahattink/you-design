'use client';

import { useEffect, useState } from 'react';
import { acquireYDoc, type YDocHandle } from './y-doc.js';
import { bindPagesSync } from './sync-pages.js';
import { bindAwareness } from './awareness.js';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function useCollabSync(projectId: string | null): YDocHandle | null {
  const [handle, setHandle] = useState<YDocHandle | null>(null);

  useEffect(() => {
    if (!projectId) {
      setHandle(null);
      return;
    }
    const acquired = acquireYDoc(projectId);
    setHandle(acquired);

    const setStatus = useWorkspaceStore.getState().setCollabStatus;
    setStatus('connecting');

    const onStatus = ({ status }: { status: string }) => {
      if (status === 'connected') setStatus('connected');
      else if (status === 'disconnected') setStatus('offline');
      else setStatus('connecting');
    };
    const onDisconnect = () => setStatus('offline');

    acquired.provider.on('status', onStatus);
    acquired.provider.on('disconnect', onDisconnect);

    const unbindPages = bindPagesSync(acquired.doc, useWorkspaceStore);
    const unbindAwareness = bindAwareness(acquired.provider, useWorkspaceStore);

    return () => {
      acquired.provider.off('status', onStatus);
      acquired.provider.off('disconnect', onDisconnect);
      unbindPages();
      unbindAwareness();
      acquired.dispose();
      setStatus('idle');
      setHandle(null);
    };
  }, [projectId]);

  return handle;
}
