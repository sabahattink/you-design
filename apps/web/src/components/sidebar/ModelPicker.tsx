'use client';

import * as React from 'react';
import Link from 'next/link';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function ModelPicker() {
  const models = useWorkspaceStore((s) => s.models);
  const defaultModelId = useWorkspaceStore((s) => s.defaultModelId);
  const setDefaultModel = useWorkspaceStore((s) => s.setDefaultModel);

  return (
    <div className="p-2 border-t border-[color:var(--color-border)]">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1">
        Model
      </div>
      <select
        value={defaultModelId ?? ''}
        onChange={(e) => setDefaultModel(e.target.value)}
        className="w-full text-xs px-2 py-1 rounded border border-[color:var(--color-border)] bg-transparent"
      >
        {models.length === 0 && <option value="">— no models —</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <Link
        href="/setup"
        className="block mt-1 text-xs text-[color:var(--color-muted)] hover:underline"
      >
        Manage providers →
      </Link>
    </div>
  );
}
