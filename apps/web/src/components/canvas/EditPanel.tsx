'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import {
  parseHtml,
  updateElement,
  toHtml,
  findElementById,
  type AstNode,
} from '@/lib/html/ast';

function getTextOf(el: AstNode): string {
  const text = el.childNodes?.find((n) => n.nodeName === '#text');
  return text?.value ?? '';
}

function getClassesOf(el: AstNode): string {
  return el.attrs?.find((a) => a.name === 'class')?.value ?? '';
}

export function EditPanel() {
  const selectedId = useWorkspaceStore((s) => s.selectedElementId);
  const page = useWorkspaceStore((s) => s.pages[s.currentPath]);
  const updateHtml = useWorkspaceStore((s) => s.updateCurrentPageHtml);
  const setSelected = useWorkspaceStore((s) => s.setSelectedElement);

  const [text, setText] = React.useState('');
  const [classes, setClasses] = React.useState('');
  const [tag, setTag] = React.useState('');

  React.useEffect(() => {
    if (!selectedId || !page) {
      setText('');
      setClasses('');
      setTag('');
      return;
    }
    const doc = parseHtml(page.html);
    const el = findElementById(doc, selectedId);
    if (!el) {
      setTag('');
      setText('');
      setClasses('');
      return;
    }
    setTag(el.tagName ?? '');
    setClasses(getClassesOf(el));
    setText(getTextOf(el));
  }, [selectedId, page]);

  if (!selectedId || !page) return null;

  const save = () => {
    const doc = parseHtml(page.html);
    updateElement(doc, selectedId, {
      text,
      classes: classes.split(/\s+/).filter(Boolean),
    });
    updateHtml(toHtml(doc));
  };

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-[color:var(--color-bg)] border-l border-[color:var(--color-border)] p-4 z-10 shadow-xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-[color:var(--color-muted)]">
            Element
          </div>
          <div className="font-mono text-sm">&lt;{tag}&gt;</div>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          aria-label="Close edit panel"
        >
          ✕
        </button>
      </div>
      <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
        Text
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full p-2 text-sm border border-[color:var(--color-border)] rounded bg-transparent"
      />
      <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
        Classes
      </label>
      <input
        value={classes}
        onChange={(e) => setClasses(e.target.value)}
        className="w-full p-2 text-sm font-mono border border-[color:var(--color-border)] rounded bg-transparent"
      />
      <button
        onClick={save}
        className="mt-2 px-4 py-2 rounded-md bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm"
      >
        Save
      </button>
    </div>
  );
}
