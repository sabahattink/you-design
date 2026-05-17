'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ open, onClose }: ShareDialogProps) {
  const projectId = useWorkspaceStore((s) => s.projectId);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const url =
    typeof window !== 'undefined' && projectId
      ? `${window.location.origin}/app?project=${projectId}`
      : '';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — user can still copy manually
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[420px] rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Share project</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Anyone with this link can edit. Authentication + roles arrive in M5c.
        </p>
        {projectId ? (
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={url}
              className="flex-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copy}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Save the project first — sharing needs a project ID.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-900">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
