'use client';

import { useWorkspaceStore } from '@/lib/workspace/store';

export function RemoteCursors() {
  const cursors = useWorkspaceStore((s) => s.remoteCursors);
  const currentPath = useWorkspaceStore((s) => s.currentPath);

  const visible = Object.values(cursors).filter(
    (c) =>
      c.cursor?.pagePath === currentPath &&
      typeof c.cursor.x === 'number' &&
      typeof c.cursor.y === 'number',
  );

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {visible.map((c) => (
        <div
          key={c.user.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75 ease-linear"
          style={{ left: c.cursor!.x ?? 0, top: c.cursor!.y ?? 0 }}
        >
          <div
            className="h-3 w-3 rounded-full ring-2 ring-white shadow"
            style={{ background: c.user.color }}
          />
          <div
            className="mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
            style={{ background: c.user.color }}
          >
            {c.user.displayName}
          </div>
        </div>
      ))}
    </div>
  );
}
