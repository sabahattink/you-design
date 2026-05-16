'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function WorkspaceLayout() {
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const pages = useWorkspaceStore((s) => s.pages);
  const currentPath = useWorkspaceStore((s) => s.currentPath);

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-[color:var(--color-border)] flex items-center px-4 text-sm">
        <span className="font-semibold">You Design</span>
        <span className="ml-3 text-[color:var(--color-muted)]">Workspace</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-[color:var(--color-border)]">
          {intentPhase}
        </span>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside
          data-testid="sidebar"
          className="w-56 border-r border-[color:var(--color-border)] overflow-y-auto"
        >
          <div className="p-3 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
            Sidebar
          </div>
          <div className="p-3 text-xs text-[color:var(--color-muted)]">
            {Object.keys(pages).length} pages · current {currentPath}
          </div>
        </aside>
        <section
          data-testid="canvas-area"
          className="flex-1 grid place-items-center bg-[color:var(--color-bg)] min-w-0"
        >
          <div className="text-[color:var(--color-muted)] text-sm">
            Canvas (will render iframe in Task 2.5)
          </div>
        </section>
        <aside
          data-testid="chat-area"
          className="w-80 border-l border-[color:var(--color-border)] overflow-y-auto"
        >
          <div className="p-3 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
            Chat
          </div>
        </aside>
      </div>
    </div>
  );
}
