'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function PageList() {
  const pages = useWorkspaceStore((s) => s.pages);
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  const setCurrentPath = useWorkspaceStore((s) => s.setCurrentPath);
  const removePage = useWorkspaceStore((s) => s.removePage);

  const list = Object.values(pages).sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="p-2">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2 px-1">
        Pages
      </div>
      {list.length === 0 && (
        <div className="text-xs italic text-[color:var(--color-muted)] px-1">No pages yet</div>
      )}
      <ul className="flex flex-col gap-0.5">
        {list.map((p) => (
          <li
            key={p.path}
            className={`flex items-center justify-between px-2 py-1 rounded text-sm cursor-pointer ${
              p.path === currentPath
                ? 'bg-[color:var(--color-border)] font-medium'
                : 'hover:bg-[color:var(--color-border)]'
            }`}
            onClick={() => setCurrentPath(p.path)}
          >
            <span className="font-mono truncate">{p.path}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${p.path}?`)) removePage(p.path);
              }}
              className="text-xs text-[color:var(--color-muted)] hover:text-red-500 ml-2"
              title="Delete page"
              aria-label={`Delete ${p.path}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
