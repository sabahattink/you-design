'use client';

import * as React from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { INJECT_SCRIPT } from './inject-script';
import { parseHtml, ensureYdIds, toHtml } from '@/lib/html/ast';
import { publishLocalCursor } from '@/lib/collab/awareness';
import { RemoteCursors } from './RemoteCursors';

const TAILWIND_CDN = 'https://cdn.tailwindcss.com';

function withTailwindAndScript(html: string): string {
  const doc = parseHtml(html);
  ensureYdIds(doc);
  let body = toHtml(doc);
  if (!body.includes('cdn.tailwindcss.com')) {
    if (body.includes('<head>')) {
      body = body.replace(
        '<head>',
        `<head><script src="${TAILWIND_CDN}"></script>`,
      );
    } else {
      body = `<head><script src="${TAILWIND_CDN}"></script></head>` + body;
    }
  }
  if (body.includes('</body>')) {
    body = body.replace(
      '</body>',
      `<script>${INJECT_SCRIPT}</script></body>`,
    );
  } else {
    body = body + `<script>${INJECT_SCRIPT}</script>`;
  }
  return body;
}

interface SelectMessage {
  source: 'you-design';
  type: 'select';
  id: string;
  bounds: { x: number; y: number; w: number; h: number };
  tag: string;
  text: string;
  classes: string[];
}

interface NavigateMessage {
  source: 'you-design';
  type: 'navigate';
  href: string;
}

interface ReadyMessage {
  source: 'you-design';
  type: 'ready';
}

interface PointerMoveMessage {
  source: 'you-design';
  type: 'pointermove';
  x: number;
  y: number;
}

interface PointerLeaveMessage {
  source: 'you-design';
  type: 'pointerleave';
}

type IframeMessage =
  | SelectMessage
  | NavigateMessage
  | ReadyMessage
  | PointerMoveMessage
  | PointerLeaveMessage;

function isOurMessage(data: unknown): data is IframeMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === 'you-design'
  );
}

interface PreviewIframeProps {
  collabProvider?: HocuspocusProvider | null;
}

export function PreviewIframe({ collabProvider }: PreviewIframeProps = {}) {
  const path = useWorkspaceStore((s) => s.currentPath);
  const page = useWorkspaceStore((s) => s.pages[s.currentPath]);
  const setSelected = useWorkspaceStore((s) => s.setSelectedElement);
  const setCurrentPath = useWorkspaceStore((s) => s.setCurrentPath);

  const [bounds, setBounds] = React.useState<
    SelectMessage['bounds'] | null
  >(null);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!isOurMessage(e.data)) return;
      if (e.data.type === 'select') {
        setSelected(e.data.id);
        setBounds(e.data.bounds);
      } else if (e.data.type === 'navigate') {
        setCurrentPath(e.data.href);
      } else if (e.data.type === 'pointermove' && collabProvider) {
        publishLocalCursor(collabProvider, { pagePath: path, x: e.data.x, y: e.data.y });
      } else if (e.data.type === 'pointerleave' && collabProvider) {
        publishLocalCursor(collabProvider, { pagePath: path, x: null, y: null });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setSelected, setCurrentPath, collabProvider, path]);

  // Reset selection overlay when page changes
  React.useEffect(() => {
    setBounds(null);
  }, [path]);

  if (!page) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-sm text-[color:var(--color-muted)] text-center px-6 max-w-md">
          No page yet — finish the intent quiz and the designer agent will
          generate one.
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        title="Preview"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={withTailwindAndScript(page.html)}
        className="w-full h-full border-0 bg-white"
        key={path}
      />
      {bounds && (
        <div
          className="absolute pointer-events-none border-2 border-[color:var(--color-accent)] rounded shadow"
          style={{
            left: bounds.x,
            top: bounds.y,
            width: bounds.w,
            height: bounds.h,
          }}
        />
      )}
      <RemoteCursors />
    </div>
  );
}
