'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { parseHtml, ensureYdIds, toHtml } from '@/lib/html/ast';

const Editor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  { ssr: false, loading: () => <div className="p-4 text-xs text-[color:var(--color-muted)]">Loading editor...</div> },
);

export function CodePanel() {
  const page = useWorkspaceStore((s) => s.pages[s.currentPath]);
  const updateHtml = useWorkspaceStore((s) => s.updateCurrentPageHtml);

  if (!page) {
    return (
      <div className="h-full grid place-items-center text-xs text-[color:var(--color-muted)]">
        No page selected
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="html"
      value={page.html}
      onChange={(value) => {
        if (typeof value !== 'string') return;
        try {
          const doc = parseHtml(value);
          ensureYdIds(doc);
          updateHtml(toHtml(doc));
        } catch {
          // ignore mid-typing invalid HTML
        }
      }}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}
