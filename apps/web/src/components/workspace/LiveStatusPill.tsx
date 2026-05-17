'use client';

import { useWorkspaceStore } from '@/lib/workspace/store';

export function LiveStatusPill() {
  const status = useWorkspaceStore((s) => s.collabStatus);
  const cursors = useWorkspaceStore((s) => s.remoteCursors);

  if (status === 'idle') return null;

  const remoteCount = Object.keys(cursors).length;
  const total = remoteCount + 1;

  const dotClass =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-zinc-400';

  const label =
    status === 'offline'
      ? 'Offline (edits saved locally)'
      : status === 'connecting'
        ? 'Connecting…'
        : total > 1
          ? `Live • ${total} people`
          : 'Live';

  const names = Object.values(cursors)
    .map((c) => c.user.displayName)
    .join(', ');

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white/80 px-2 py-0.5 text-xs"
      title={names || 'Just you'}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}
