'use client';

import { useWorkspaceStore } from '@/lib/workspace/store';
import type { CollabStatus } from '@/lib/collab/types';

const DOT_CLASS: Record<Exclude<CollabStatus, 'idle'>, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  offline: 'bg-zinc-400',
  denied: 'bg-red-500',
};

const DENIED_HINT =
  'The share link is invalid, expired or was revoked. Ask the project owner for a new link.';

export function LiveStatusPill() {
  const status = useWorkspaceStore((s) => s.collabStatus);
  const access = useWorkspaceStore((s) => s.collabAccess);
  const cursors = useWorkspaceStore((s) => s.remoteCursors);

  if (status === 'idle') return null;

  const remoteCount = Object.keys(cursors).length;
  const total = remoteCount + 1;

  const baseLabel =
    status === 'denied'
      ? 'Access denied'
      : status === 'offline'
        ? 'Offline (edits saved locally)'
        : status === 'connecting'
          ? 'Connecting…'
          : total > 1
            ? `Live • ${total} people`
            : 'Live';
  const label =
    status === 'connected' && access === 'readonly' ? `${baseLabel} • View only` : baseLabel;

  const names = Object.values(cursors)
    .map((c) => c.user.displayName)
    .join(', ');

  return (
    <div
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white/80 px-2 py-0.5 text-xs"
      title={status === 'denied' ? DENIED_HINT : names || 'Just you'}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT_CLASS[status]}`} />
      <span>{label}</span>
    </div>
  );
}
