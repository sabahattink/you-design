'use client';

import { useEffect, useState } from 'react';
import { acquireYDoc, type YDocHandle } from './y-doc.js';
import { bindPagesSync } from './sync-pages.js';
import { bindAwareness } from './awareness.js';
import { collabTokens } from './tokens.js';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function useCollabSync(projectId: string | null): YDocHandle | null {
  const [handle, setHandle] = useState<YDocHandle | null>(null);

  useEffect(() => {
    if (!projectId) {
      setHandle(null);
      return;
    }
    const acquired = acquireYDoc(projectId, {
      token: () => collabTokens.resolve(projectId),
    });
    setHandle(acquired);

    const { setCollabStatus: setStatus, setCollabAccess } = useWorkspaceStore.getState();
    setStatus('connecting');
    setCollabAccess(null);

    // Once access is denied the provider stops reconnecting; keep the status
    // pinned to 'denied' instead of letting later socket events overwrite it.
    let isDenied = false;

    const onStatus = ({ status }: { status: string }) => {
      if (isDenied) return;
      if (status === 'connected') setStatus('connected');
      else if (status === 'disconnected') setStatus('offline');
      else setStatus('connecting');
    };
    const onDisconnect = () => {
      if (!isDenied) setStatus('offline');
    };
    const onAuthenticated = () => {
      setCollabAccess(acquired.provider.authorizedScope === 'readonly' ? 'readonly' : 'read-write');
    };
    const onAuthenticationFailed = () => {
      isDenied = true;
      setStatus('denied');
      setCollabAccess(null);
    };

    acquired.provider.on('status', onStatus);
    acquired.provider.on('disconnect', onDisconnect);
    acquired.provider.on('authenticated', onAuthenticated);
    acquired.provider.on('authenticationFailed', onAuthenticationFailed);

    const unbindPages = bindPagesSync(acquired.doc, useWorkspaceStore, {
      readOnly: collabTokens.shareRole(projectId) === 'view',
    });
    const unbindAwareness = bindAwareness(acquired.provider, useWorkspaceStore);

    return () => {
      acquired.provider.off('status', onStatus);
      acquired.provider.off('disconnect', onDisconnect);
      acquired.provider.off('authenticated', onAuthenticated);
      acquired.provider.off('authenticationFailed', onAuthenticationFailed);
      unbindPages();
      unbindAwareness();
      acquired.dispose();
      setStatus('idle');
      setCollabAccess(null);
      setHandle(null);
    };
  }, [projectId]);

  return handle;
}
